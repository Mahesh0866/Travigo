import { useState, useEffect, useRef } from 'react';
import { getDestinationSuggestions } from '../services/api';

export default function Hero({ query, setQuery, onSearch }) {
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const debounceTimerRef = useRef(null);
  // Flag to track when a search was just executed (so we don't reopen dropdown until user types again)
  const isSearchExecutedRef = useRef(false);

  // 350ms debounce for fetching real-time suggestions while typing
  useEffect(() => {
    const trimmed = (query || '').trim();

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // If search was just executed (by Enter or clicking suggestion), do NOT fetch or show suggestions
    if (isSearchExecutedRef.current) {
      setShowDropdown(false);
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    if (trimmed.length < 1) {
      setSuggestions([]);
      setIsLoading(false);
      setShowDropdown(false);
      setSelectedIndex(-1);
      return;
    }

    setIsLoading(true);
    setSelectedIndex(-1);

    debounceTimerRef.current = setTimeout(async () => {
      // Re-check in case search was triggered during the debounce window
      if (isSearchExecutedRef.current) {
        setIsLoading(false);
        return;
      }
      try {
        const results = await getDestinationSuggestions(trimmed, 6);
        if (!isSearchExecutedRef.current) {
          setSuggestions(results);
          setShowDropdown(true);
        }
      } catch (err) {
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 350);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query]);

  // Handle clicking outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    // User is actively typing again: allow suggestions to show
    isSearchExecutedRef.current = false;
    setQuery(e.target.value);
  };

  const handleSelectSuggestion = (suggestion) => {
    const chosenName = suggestion.name || suggestion.city || suggestion.formatted;
    // Mark search executed so suggestions immediately close and don't re-trigger from setQuery
    isSearchExecutedRef.current = true;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setShowDropdown(false);
    setSuggestions([]);
    setIsLoading(false);
    setQuery(chosenName);
    if (onSearch) {
      onSearch(chosenName);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      if (showDropdown) {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
      }
    } else if (e.key === 'ArrowUp') {
      if (showDropdown) {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
      }
    } else if (e.key === 'Enter') {
      // If a dropdown item is highlighted with arrow keys, select it
      if (showDropdown && selectedIndex >= 0 && selectedIndex < suggestions.length) {
        e.preventDefault();
        handleSelectSuggestion(suggestions[selectedIndex]);
      } else {
        // Normal enter press: trigger search and immediately hide suggestions
        isSearchExecutedRef.current = true;
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        setShowDropdown(false);
        setSuggestions([]);
        setIsLoading(false);
        if (onSearch) {
          onSearch();
        }
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    isSearchExecutedRef.current = true;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setShowDropdown(false);
    setSuggestions([]);
    setIsLoading(false);
    if (onSearch) {
      onSearch();
    }
  };

  return (
    <section className="bg-primary-container text-on-primary py-xl md:py-32 relative overflow-visible">
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary opacity-20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-secondary opacity-20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="max-w-container-max mx-auto px-margin-mobile md:px-lg text-center relative z-20">
        <h1 className="font-display-lg text-display-lg-mobile md:text-[64px] mb-lg max-w-4xl mx-auto leading-[1.1] font-bold">
          Explore Your Next Adventure
        </h1>

        <div className="max-w-3xl mx-auto mt-xl relative" ref={containerRef}>
          <form
            onSubmit={handleSubmit}
            className="flex flex-col md:flex-row gap-sm bg-white p-2 rounded-2xl shadow-2xl border border-primary/10 relative z-30"
          >
            <div className="flex-1 flex items-center px-lg py-md relative">
              <span className="material-symbols-outlined text-outline mr-md text-[24px] flex-shrink-0">
                {isLoading ? 'progress_activity' : 'search'}
              </span>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={handleInputChange}
                onFocus={() => {
                  if (
                    !isSearchExecutedRef.current &&
                    query &&
                    query.trim().length >= 1 &&
                    suggestions.length > 0
                  ) {
                    setShowDropdown(true);
                  }
                }}
                onKeyDown={handleKeyDown}
                className="w-full border-none focus:ring-0 text-on-surface font-body-lg p-0 placeholder:text-outline/60 outline-none"
                placeholder="Search destinations, e.g. Matheran, Manali, Goa..."
                autoComplete="off"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    isSearchExecutedRef.current = false;
                    setQuery('');
                    setSuggestions([]);
                    setShowDropdown(false);
                    inputRef.current?.focus();
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-full transition-colors ml-2"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              )}
            </div>
            <button
              type="submit"
              className="bg-primary text-on-primary px-xl py-lg rounded-xl font-label-md text-label-md hover:bg-primary/90 transition-colors duration-200 shadow-md flex items-center justify-center gap-2"
            >
              <span>Search Destinations</span>
            </button>
          </form>

          {/* ── Real-Time Destination Suggestions Dropdown ── */}
          {showDropdown && !isSearchExecutedRef.current && query && query.trim().length >= 1 && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 text-left animate-in fade-in slide-in-from-top-2 duration-150">
              {/* Header Badge */}
              <div className="px-4 py-2.5 bg-slate-50 border-b border-gray-100 flex items-center justify-between text-xs text-gray-500 font-medium">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-violet-600">explore</span>
                  <span>Destination Suggestions</span>
                </span>
                {isLoading && (
                  <span className="flex items-center gap-1 text-violet-600 font-medium">
                    <span className="w-3 h-3 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin"></span>
                    <span>Finding places...</span>
                  </span>
                )}
              </div>

              {/* Suggestions List */}
              {suggestions.length > 0 ? (
                <ul className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
                  {suggestions.map((item, idx) => {
                    const isSelected = selectedIndex === idx;
                    return (
                      <li
                        key={idx}
                        onClick={() => handleSelectSuggestion(item)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`px-4 py-3 cursor-pointer transition-all flex items-center gap-3 ${
                          isSelected
                            ? 'bg-violet-50 text-violet-900 pl-5'
                            : 'hover:bg-gray-50 text-gray-800'
                        }`}
                      >
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                            isSelected ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[18px]">location_on</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-sm text-gray-900 truncate">
                              {item.name}
                            </p>
                            {item.category && (
                              <span className="text-[10px] font-semibold bg-violet-100/70 text-violet-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                                {item.category}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate mt-0.5">
                            {item.formatted || `${item.state ? item.state + ', ' : ''}${item.country || 'India'}`}
                          </p>
                        </div>
                        <span className="material-symbols-outlined text-gray-300 text-[18px] flex-shrink-0">
                          north_west
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : !isLoading ? (
                <div className="p-6 text-center text-gray-500">
                  <span className="material-symbols-outlined text-[36px] text-gray-300 block mb-1">
                    location_off
                  </span>
                  <p className="text-sm font-semibold text-gray-700">No destination suggestions found</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Try searching for famous cities, hill stations, or regions like "Manali", "Matheran", or "Goa"
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
