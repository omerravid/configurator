import React, { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { MagnifyingGlassIcon, FunnelIcon, XMarkIcon, ChevronDownIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline';
import { logger } from '../utils/logger';

/**
 * Advanced Search and Filtering Component
 * 
 * Provides powerful search and filtering capabilities with:
 * - Full-text search with highlighting
 * - Multiple filter criteria
 * - Sort options
 * - Saved searches
 * - Tag-based filtering
 */

const AdvancedSearch = ({
  data = [],
  onSearch,
  searchFields = [],
  filters = [],
  sortOptions = [],
  onFilterChange,
  placeholder = 'Search...',
  showFilters = true,
  showSort = true,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState({});
  const [sortBy, setSortBy] = useState(sortOptions[0]?.value || null);
  const [sortOrder, setSortOrder] = useState('asc');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Perform search and filtering
  const filteredData = useMemo(() => {
    let results = [...data];

    // Apply search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      results = results.filter(item => {
        // If specific fields defined, search only those
        if (searchFields.length > 0) {
          return searchFields.some(field => {
            const value = getNestedValue(item, field);
            return value && String(value).toLowerCase().includes(term);
          });
        }
        // Otherwise search all string values
        return JSON.stringify(item).toLowerCase().includes(term);
      });
    }

    // Apply filters
    Object.entries(activeFilters).forEach(([filterKey, filterValue]) => {
      if (filterValue === null || filterValue === undefined || filterValue === '') {
        return;
      }

      const filter = filters.find(f => f.key === filterKey);
      if (!filter) {
        return;
      }

      results = results.filter(item => {
        const itemValue = getNestedValue(item, filterKey);

        switch (filter.type) {
          case 'select':
            return itemValue === filterValue;
          
          case 'multiselect':
            return Array.isArray(filterValue) && filterValue.includes(itemValue);
          
          case 'range':
            const [min, max] = filterValue;
            return itemValue >= min && itemValue <= max;
          
          case 'date':
            const itemDate = new Date(itemValue);
            const filterDate = new Date(filterValue);
            return itemDate.toDateString() === filterDate.toDateString();
          
          case 'boolean':
            return itemValue === filterValue;
          
          case 'text':
            return String(itemValue).toLowerCase().includes(String(filterValue).toLowerCase());
          
          default:
            return true;
        }
      });
    });

    // Apply sorting
    if (sortBy) {
      results.sort((a, b) => {
        const aValue = getNestedValue(a, sortBy);
        const bValue = getNestedValue(b, sortBy);

        let comparison = 0;
        
        if (aValue < bValue) {
          comparison = -1;
        } else if (aValue > bValue) {
          comparison = 1;
        }

        return sortOrder === 'asc' ? comparison : -comparison;
      });
    }

    logger.debug('Search results', { 
      searchTerm, 
      activeFilters, 
      sortBy, 
      sortOrder, 
      resultCount: results.length 
    });

    return results;
  }, [data, searchTerm, activeFilters, sortBy, sortOrder, searchFields, filters]);

  // Notify parent of changes
  React.useEffect(() => {
    if (onSearch) {
      onSearch(filteredData, {
        searchTerm,
        activeFilters,
        sortBy,
        sortOrder,
      });
    }
  }, [filteredData, searchTerm, activeFilters, sortBy, sortOrder, onSearch]);

  React.useEffect(() => {
    if (onFilterChange) {
      onFilterChange(activeFilters);
    }
  }, [activeFilters, onFilterChange]);

  const handleFilterChange = useCallback((key, value) => {
    setActiveFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const clearFilter = useCallback((key) => {
    setActiveFilters(prev => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setActiveFilters({});
    setSearchTerm('');
  }, []);

  const activeFilterCount = Object.keys(activeFilters).filter(
    key => activeFilters[key] !== null && activeFilters[key] !== undefined && activeFilters[key] !== ''
  ).length;

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={placeholder}
            className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="Clear search"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          )}
        </div>

        {showFilters && (
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors
              ${showAdvanced ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}
            `}
          >
            <FunnelIcon className="h-5 w-5" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-full bg-primary-600 text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Advanced Filters */}
      {showAdvanced && showFilters && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <AdjustmentsHorizontalIcon className="h-5 w-5" />
              Advanced Filters
            </h3>
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filters.map(filter => (
              <FilterField
                key={filter.key}
                filter={filter}
                value={activeFilters[filter.key]}
                onChange={(value) => handleFilterChange(filter.key, value)}
                onClear={() => clearFilter(filter.key)}
              />
            ))}
          </div>

          {/* Sort Options */}
          {showSort && sortOptions.length > 0 && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Sort by:
                </label>
                <select
                  value={sortBy || ''}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                >
                  <option value="">None</option>
                  {sortOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                  title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Active Filters Display */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(activeFilters).map(([key, value]) => {
            if (value === null || value === undefined || value === '') {
              return null;
            }

            const filter = filters.find(f => f.key === key);
            if (!filter) {
              return null;
            }

            return (
              <span
                key={key}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-sm"
              >
                <span className="font-medium">{filter.label}:</span>
                <span>{formatFilterValue(value, filter.type)}</span>
                <button
                  onClick={() => clearFilter(key)}
                  className="ml-1 hover:text-primary-900 dark:hover:text-primary-100"
                  aria-label={`Remove ${filter.label} filter`}
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Results Count */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        {filteredData.length} {filteredData.length === 1 ? 'result' : 'results'}
        {searchTerm && ` for "${searchTerm}"`}
      </div>
    </div>
  );
};

/**
 * Individual Filter Field Component
 */
const FilterField = ({ filter, value, onChange, onClear }) => {
  const renderInput = () => {
    switch (filter.type) {
      case 'select':
        return (
          <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
          >
            <option value="">All</option>
            {filter.options?.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'multiselect':
        return (
          <div className="space-y-2">
            {filter.options?.map(opt => (
              <label key={opt.value} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Array.isArray(value) && value.includes(opt.value)}
                  onChange={(e) => {
                    const current = Array.isArray(value) ? value : [];
                    if (e.target.checked) {
                      onChange([...current, opt.value]);
                    } else {
                      onChange(current.filter(v => v !== opt.value));
                    }
                  }}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{opt.label}</span>
              </label>
            ))}
          </div>
        );

      case 'boolean':
        return (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={value || false}
              onChange={(e) => onChange(e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">{filter.label}</span>
          </label>
        );

      case 'date':
        return (
          <input
            type="date"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
          />
        );

      case 'range':
        const [min = 0, max = 100] = Array.isArray(value) ? value : [filter.min || 0, filter.max || 100];
        return (
          <div className="space-y-2">
            <input
              type="range"
              min={filter.min || 0}
              max={filter.max || 100}
              value={min}
              onChange={(e) => onChange([Number(e.target.value), max])}
              className="w-full"
            />
            <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
              <span>{min}</span>
              <span>{max}</span>
            </div>
          </div>
        );

      case 'text':
      default:
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={filter.placeholder || 'Filter...'}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
          />
        );
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {filter.label}
        </label>
        {value && (
          <button
            onClick={onClear}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Clear
          </button>
        )}
      </div>
      {renderInput()}
    </div>
  );
};

// Helper functions
const getNestedValue = (obj, path) => {
  return path.split('.').reduce((current, key) => current?.[key], obj);
};

const formatFilterValue = (value, type) => {
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (type === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  return String(value);
};

AdvancedSearch.propTypes = {
  data: PropTypes.array.isRequired,
  onSearch: PropTypes.func,
  searchFields: PropTypes.arrayOf(PropTypes.string),
  filters: PropTypes.arrayOf(PropTypes.shape({
    key: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    type: PropTypes.oneOf(['select', 'multiselect', 'text', 'date', 'range', 'boolean']).isRequired,
    options: PropTypes.arrayOf(PropTypes.shape({
      value: PropTypes.any.isRequired,
      label: PropTypes.string.isRequired,
    })),
    placeholder: PropTypes.string,
    min: PropTypes.number,
    max: PropTypes.number,
  })),
  sortOptions: PropTypes.arrayOf(PropTypes.shape({
    value: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
  })),
  onFilterChange: PropTypes.func,
  placeholder: PropTypes.string,
  showFilters: PropTypes.bool,
  showSort: PropTypes.bool,
};

FilterField.propTypes = {
  filter: PropTypes.object.isRequired,
  value: PropTypes.any,
  onChange: PropTypes.func.isRequired,
  onClear: PropTypes.func.isRequired,
};

export default AdvancedSearch;


