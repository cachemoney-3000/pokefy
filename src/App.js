import React, { Component, Suspense, useState, useEffect } from 'react';

import "./App.css"
import PokeCard from './components/PokeCard'
import PokeInfo from './components/PokeInfo'

class App extends Component {
  constructor() {
    super();
    this.state = {
      pokemons : [],
      pokemonDetails : [],
      offset: 0,
      loadNumber: 20,
      loading: false,
      selectedPokemon: null,
      description: '',
      evolutionChain: []
    }
    this.handleIntersection = this.handleIntersection.bind(this);
    this.selectPokemon = this.selectPokemon.bind(this);
  }

  getNextOffset() {
    return this.state.offset+this.state.loadNumber;
  }

  handleIntersection(entries) {
    if (entries[0].isIntersecting) {
      const newOffset = this.getNextOffset();
      this.setState({offset: newOffset, loading: true}, () => {
        this.getMorePokemon();
      });
    }
  }

  async getDescription(pokemon) {
    const speciesUrl = pokemon.species.url;
    const response = await fetch(speciesUrl);
    const data = await response.json();
    const englishFlavorText = data.flavor_text_entries.find(entry => entry.language.name === 'en').flavor_text.replace('', ' ');
    this.setState({ description: englishFlavorText });
  }

  async  getEvolutionChain(pokemon) {
    const speciesUrl = pokemon.species.url;
    const speciesResponse = await fetch(speciesUrl);
    const speciesData = await speciesResponse.json();
  
    const evolutionChainUrl = speciesData.evolution_chain.url;
    const evolutionChainResponse = await fetch(evolutionChainUrl);
    const evolutionChainData = await evolutionChainResponse.json();
    
    this.setState({ evolutionChain: evolutionChainData.chain });
  }
  

  async selectPokemon(pokemon) {
    console.log(pokemon)
    this.setState({ selectedPokemon: pokemon, loading: true });
    if (pokemon) {
      this.getDescription(pokemon);
      await this.getEvolutionChain(pokemon);
    }
  }
  
  componentDidMount() {
    this.getMorePokemon();
    this.observer = new IntersectionObserver(this.handleIntersection, {rootMargin: '0px', threshold: 1});
    this.observer.observe(document.querySelector('#intersection'));
  }

  getMorePokemon() {
    let url = "https://pokeapi.co/api/v2/pokemon?offset=" + this.state.offset + "&limit=" + this.state.loadNumber;
    fetch(url)
    .then(response => response.json())
    .then(data => {
      if (data) {
        const { pokemons } = this.state;
        this.setState({pokemons : [...pokemons, ...data.results]}) // combine new and existing pokemons
        
        data.results.forEach(pokemon => {
          fetch(pokemon.url)
          .then(response => response.json())
          .then(data => {
            if (data) {
              var temp = this.state.pokemonDetails
              temp.push(data)
              this.setState({pokemonDetails: temp}) // update pokemon details
                
              // check if all pokemon details are fetched
              if (temp.length === pokemons.length + (data.results ? data.results.indexOf(pokemon) : 0) + 1) {
                this.setState({ loading: false }); // set loading to false
              }

            }            
          })
          .catch(console.log)
        })
      }
    })
    .catch(console.log)
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.selectedPokemon !== this.state.selectedPokemon) {
      if (this.state.loading) {
        this.setState({ loading: false });
      } else {
        this.setState({ loading: true }, () => {
          setTimeout(() => {
            this.setState({ loading: false });
          }, 1000);
        });
      }
    }
  }
  
  render() {
    const { pokemonDetails, loading, selectedPokemon, description, evolutionChain } = this.state;
    const renderedPokemonList = pokemonDetails.map((pokemon) => (
      <PokeCard 
        pokemon={pokemon} 
        onClick={() => this.selectPokemon(pokemon)}
      />
    ));
    
    const handlePokemonClick = (pokemon) => {
      console.log(`You clicked on ${pokemon}!`);
    };

    return (
      <div className="flex flex-wrap lg:px-10 pb-20 md:pb-32 lg:pt-5 pt-3">
        <div className="w-full lg:w-3/4 p-4" style={{ overflowY: 'auto' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mr-auto ml-auto w-fit lg:gap-5 md:gap-4 sm:gap-3 gap-2 content-center">
            {renderedPokemonList}
            <div id="intersection"></div>
          </div>
          <div id="loading">{loading ? 'Loading...' : null}</div>
        </div>
        {selectedPokemon  && evolutionChain && Object.keys(evolutionChain).length > 0 && (
          <div className="w-58 h-screen lg:w-1/4 p-4 sticky top-0 overflow-y-hidden">
            <React.Fragment>
                <PokeInfo 
                  pokemon={selectedPokemon} 
                  description={description}
                  evolutionChain={evolutionChain}
                  onPokemonClick={handlePokemonClick}
                />
              </React.Fragment>
          </div>
        )}
      </div>
    );
  }
  
  
  
}
      
export default App;
