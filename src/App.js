import React, { Component } from 'react';

import * as $ from "jquery";
import { clientId } from "./config";
import { exchangeCodeForToken } from "./utils/auth";

import "./App.css"
import MainPage from './pages/MainPage'
import LoginPage from './pages/LoginPage'

class App extends Component {
	constructor() {
		super();
		this.state = {
			// Pokemons
			pokemons: [],
			pokemonDetails: [],
			offset: 0,
			loadNumber: 20,
			loading: true,
			selectedPokemon: null,
			description: '',
			evolutionChain: [],

			// Spotify
			token: null,
			playlist: null,
			no_data: false,
			showPlaylistPopup: false,
			observerInitialized: false
		};
		// Pokemon
		this.handleIntersection = this.handleIntersection.bind(this);
		this.selectPokemon = this.selectPokemon.bind(this);

		// Spotify
		this.generatePlaylist = this.generatePlaylist.bind(this);
		this.addPlaylistToAccount = this.addPlaylistToAccount.bind(this);
	}


	async setSpotifyToken() {
		// Check for authorization code in URL
		const urlParams = new URLSearchParams(window.location.search);
		const code = urlParams.get('code');

		if (code) {
			try {
				// Exchange the code for tokens
				const { access_token, refresh_token, expires_in } = await exchangeCodeForToken(code);

				// Clear the code from URL
				window.history.replaceState({}, document.title, "/");

				// Set token in state
				this.setState({
					token: access_token
				});

				// Store tokens
				localStorage.setItem('spotifyAccessToken', access_token);
				localStorage.setItem('spotifyRefreshToken', refresh_token);

				// Set token expiration
				const expirationTime = Date.now() + (expires_in * 1000);
				localStorage.setItem('spotifyTokenExpiration', expirationTime);

				// Set interval to check token's expiration time
				setInterval(() => {
					const tokenExpirationTime = localStorage.getItem('spotifyTokenExpiration');
					if (tokenExpirationTime && Date.now() >= tokenExpirationTime) {
						this.refreshSpotifyToken();
					}
				}, 30000);
			} catch (error) {
				console.error('Error exchanging code for token:', error);
				this.setState({ token: null });
			}
		} else {
			// Check if we have a stored token
			const storedToken = localStorage.getItem('spotifyAccessToken');
			if (storedToken) {
				this.setState({
					token: storedToken
				});
			}
		}
	}

	refreshSpotifyToken() {
		const refreshToken = localStorage.getItem('spotifyRefreshToken');
		const client_Id = clientId;
		const tokenEndpoint = 'https://accounts.spotify.com/api/token';

		const params = new URLSearchParams();
		params.append('grant_type', 'refresh_token');
		params.append('refresh_token', refreshToken);
		params.append('client_id', client_Id);

		fetch(tokenEndpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: params
		})
		.then(response => response.json())
		.then(data => {
			// Update state with new access token
			this.setState({
				token: data.access_token,
			});

			// Store new access token in local storage
			localStorage.setItem('spotifyAccessToken', data.access_token);

			// Set new token expiration time
			const newTokenExpirationTime = Date.now() + (data.expires_in * 1000);
			localStorage.setItem('spotifyTokenExpiration', newTokenExpirationTime);

			// Store new refresh token if provided
			if (data.refresh_token) {
				localStorage.setItem('spotifyRefreshToken', data.refresh_token);
			}
		})
		.catch(error => {
			console.error('Error refreshing Spotify token:', error);
			// Handle error - maybe redirect to login
			this.setState({ token: null, selectedPokemon: null, showPlaylistPopup: false });
		});
	}

	async componentDidMount() {
		this.setSpotifyToken()

		try {
			const allPokemonResponse = await fetch('https://pokeapi.co/api/v2/pokemon?limit=1118');
			const allPokemonData = await allPokemonResponse.json();

			const allPokemonDetails = [];
			for (let i = 0; i < allPokemonData.results.length; i += 50) {
				const batchPokemonData = allPokemonData.results.slice(i, i + 50);
				const batchPokemonDetailsPromises = batchPokemonData.map(async (pokemon) => {
					const pokemonResponse = await fetch(pokemon.url);
					return pokemonResponse.json();
				});
				const batchPokemonDetails = await Promise.all(batchPokemonDetailsPromises);
				allPokemonDetails.push(...batchPokemonDetails);
			}

			this.setState({
				pokemons: allPokemonData.results,
				pokemonDetails: allPokemonDetails,
				loading: false
			});

		} catch (error) {
			console.log(error);
		}
	}

	componentDidUpdate(prevProps, prevState) {
		// Check if MainPage has just been loaded and observer hasn't been set yet
		if (!this.state.loading && !this.state.observerInitialized) {
			this.initializeObserver();
			this.setState({ observerInitialized: true });
		}
	}

	initializeObserver = () => {
		const intersectionElement = document.querySelector('#intersection');
		if (intersectionElement) {
			this.observer = new IntersectionObserver(this.handleIntersection, {
				rootMargin: '0px',
				threshold: 1
			});
			this.observer.observe(intersectionElement);
		}
	};

	getNextOffset() {
		return this.state.offset + this.state.loadNumber;
	}

	handleIntersection(entries) {
		if (entries[0].isIntersecting) {
			this.setState(prevState => ({
				offset: prevState.offset + prevState.loadNumber
			}));
		}
	}

	async getDescription(pokemon) {
		const speciesUrl = pokemon.species.url;
		const response = await fetch(speciesUrl);
		const data = await response.json();
		const englishFlavorText = data.flavor_text_entries.find(entry => entry.language.name === 'en').flavor_text.replace('', ' ');
		this.setState({ description: englishFlavorText });
	}

	async getEvolutionChain(pokemon) {
		const speciesUrl = pokemon.species.url;
		const speciesResponse = await fetch(speciesUrl);
		const speciesData = await speciesResponse.json();

		const evolutionChainUrl = speciesData.evolution_chain.url;
		const evolutionChainResponse = await fetch(evolutionChainUrl);
		const evolutionChainData = await evolutionChainResponse.json();

		this.setState({ evolutionChain: evolutionChainData.chain });
	}

	// Selecting a Pokemon
	async selectPokemon(pokemon) {
		this.setState({ selectedPokemon: pokemon, loading: false,  showPlaylistPopup: false});
		if (pokemon) {
			this.getDescription(pokemon);
			await this.getEvolutionChain(pokemon);
		}
	}

	async generatePlaylist(genres, name, id, imgSrc) {
		const tokenExpirationTime = localStorage.getItem('spotifyTokenExpiration');

		// Check if the token is expired
		if (!tokenExpirationTime || Date.now() >= tokenExpirationTime) {
			try {
				// Confirm dialog with an OK option
				if (window.confirm('Your session token has expired. Click OK to refresh the page and re-login.')) {
					window.location.reload();
				}
				return;
			} catch (error) {
				console.error('Failed to refresh token:', error);
				this.setState({ token: null, selectedPokemon: null, showPlaylistPopup: false });
				return; // Exit the function if token refresh fails
			}
		}

		if (this.state.token !== null) {
			let popularity = Math.floor(Math.random() * 13) * 5 + 40;

			// Generate a random letter or word to search for
			let searchQuery = String.fromCharCode(Math.floor(Math.random() * 26) + 97);

			try {
				// Make a request to the /v1/search endpoint
				let searchResponse = await fetch(`https://api.spotify.com/v1/search?type=artist&q=${searchQuery}`, {
					headers: {
						Authorization: `Bearer ${this.state.token}`,
					},
				});
				let searchData = await searchResponse.json();

				// Extract a random artist ID from the search results
				let artistIds = searchData.artists.items.map((artist) => artist.id);
				let randomArtistId = artistIds[Math.floor(Math.random() * artistIds.length)];

				// Make a call to generate a new playlist
				const data = await new Promise((resolve, reject) => {
					$.ajax({
						url: `https://api.spotify.com/v1/recommendations?seed_genres=${genres}`,
						type: "GET",
						beforeSend: (xhr) => {
							xhr.setRequestHeader("Authorization", "Bearer " + this.state.token);
						},
						data: {
							seed_artists: randomArtistId,
							limit: 10,
							target_popularity: popularity
						},
						success: (data) => {
							resolve(data);
						},
						error: (error) => {
							if (error.status === 401) {
								// Handle 401 error here
								console.log('401 error: Unauthorized');
								this.setState({ token: null, selectedPokemon: null, showPlaylistPopup: false});
							}
							reject(error);
						},
					});
				});

				// Checks if the data is not empty
				if (!data || !data.tracks) {
					this.setState({
						no_data: true,
					});
					return;
				}

				this.setState(
					{
						playlist: {
							id: null,
							name: `${name}'s Playlist`,
							description: "This playlist was created using PokeFi",
							external_urls: null,
							tracks: data.tracks,
							genres: genres,
							added: false,
						},
						showPlaylistPopup: true, // Set the value of showPlaylistPopup to true
					}
				);
			} catch (error) {
				console.error("Error during playlist generation:", error);
				// Handle session expiration or other unexpected errors
				if (window.confirm('An error occurred while generating the playlist. Your session may have expired. Click OK to refresh the page and re-login.')) {
					window.location.reload();
				}
			}
		}
	}

	addPlaylistToAccount() {
		// Fetch the user's playlists
		$.ajax({
			url: `https://api.spotify.com/v1/me/playlists`,
			type: "GET",
			beforeSend: (xhr) => {
			xhr.setRequestHeader("Authorization", "Bearer " + this.state.token);
			},
			success: (playlistsResponse) => {
				const playlists = playlistsResponse.items;
				// Check if there is already a playlist with the same name
				let existingPlaylist = null;
				for (let i = 0; i < playlists.length; i++) {
					if (playlists[i].name === this.state.playlist.name) {
						existingPlaylist = playlists[i];
						break;
					}
				}

				if (existingPlaylist) {
					// If there is an existing playlist with the same name, update it
					$.ajax({
						url: `https://api.spotify.com/v1/playlists/${existingPlaylist.id}/tracks`,
						type: "PUT",
						beforeSend: (xhr) => {
							xhr.setRequestHeader("Authorization", "Bearer " + this.state.token);
						},
						contentType: "application/json",
						data: JSON.stringify({
							uris: this.state.playlist.tracks.map((track) => track.uri),
						}),
						success: () => {
							// Redirect to the updated playlist URL
							window.open(existingPlaylist.external_urls.spotify, '_blank');
						},
					});
				}

				else {
					// If there is no existing playlist with the same name, create a new one
					$.ajax({
						url: `https://api.spotify.com/v1/me/playlists`,
						type: "POST",
						beforeSend: (xhr) => {
							xhr.setRequestHeader("Authorization", "Bearer " + this.state.token);
						},
						contentType: "application/json",
						data: JSON.stringify({
							name: this.state.playlist.name,
							description: this.state.playlist.description,
						}),
						success: (playlist) => {
							// Add tracks to the playlist
							$.ajax({
								url: `https://api.spotify.com/v1/playlists/${playlist.id}/tracks`,
								type: "POST",
								beforeSend: (xhr) => {
									xhr.setRequestHeader("Authorization", "Bearer " + this.state.token);
								},
								contentType: "application/json",
								data: JSON.stringify({
									uris: this.state.playlist.tracks.map((track) => track.uri),
								}),
								success: () => {
									// Redirect to the new playlist URL
									window.open(playlist.external_urls.spotify, '_blank');
								},
							});
						},
					});
				}
			},
		});
	}


	render() {
		const { pokemonDetails, loading, selectedPokemon, description, evolutionChain, offset, loadNumber, token, showPlaylistPopup, playlist} = this.state;

		return (
			<div className='bg-[#2b292c] h-dvh'>
				{token !== null ? (
					<MainPage
						pokemonDetails={pokemonDetails}
						loading={loading}
						selectedPokemon={selectedPokemon}
						description={description}
						evolutionChain={evolutionChain}
						offset={offset}
						loadNumber={loadNumber}
						selectPokemon={(pokemon) => this.selectPokemon(pokemon)}
						generatePlaylistFromParams={this.generatePlaylist}
						handleLogout={() => this.setState({ token: null, showPlaylistPopup: false })}
						showPlaylistPopup={showPlaylistPopup}
						playlist={playlist}
						onPlaylistPopupClose={() => this.setState({ showPlaylistPopup: false })}
						onPlaylistCatch={this.addPlaylistToAccount}
					/>
				) : (
				<div className='flex justify-center items-center'>
					<LoginPage/>
				</div>
				)}
			</div>
		);
	}
}

export default App;
