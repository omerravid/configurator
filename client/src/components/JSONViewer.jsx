import React, { useState } from "react";

const ProvenanceTooltip = ({ source, isVisible, position }) => {
  if (!isVisible || !source) return null;

  const getTypeColor = (type) => {
    switch (type) {
      case "PRODUCT":
        return "text-blue-600 bg-blue-50";
      case "INSTANCE":
        return "text-green-600 bg-green-50";
      case "USER":
        return "text-purple-600 bg-purple-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  return (
    <div
      className="fixed z-50 px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-lg max-w-xs"
      style={{
        left: Math.min(position.x + 10, window.innerWidth - 250),
        top: Math.max(position.y - 10, 10),
      }}
    >
      <div className="text-xs font-medium text-gray-700 mb-1">Defined in:</div>
      <div
        className={`text-sm font-medium px-2 py-1 rounded ${getTypeColor(source.type)}`}
      >
        {source.type}: {source.name}
      </div>
      <div className="text-xs text-gray-500 mt-1">ID: {source.id}</div>
    </div>
  );
};

const JSONValue = ({ value, path = "", onHover, onHoverEnd }) => {
  const [hoveredPath, setHoveredPath] = useState(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const handleMouseEnter = (e, currentPath, source) => {
    const rect = e.target.getBoundingClientRect();
    setMousePosition({
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
    setHoveredPath(currentPath);
    onHover?.(currentPath, source);
  };

  const handleMouseLeave = () => {
    setHoveredPath(null);
    onHoverEnd?.();
  };

  const renderValue = (val, currentPath) => {
    // Handle provenance-wrapped values
    if (
      val &&
      typeof val === "object" &&
      val.value !== undefined &&
      val.source
    ) {
      const actualValue = val.value;
      const source = val.source;

      if (actualValue === null) {
        return (
          <span
            className="text-gray-400 cursor-help hover:bg-yellow-100 px-1 rounded"
            onMouseEnter={(e) => handleMouseEnter(e, currentPath, source)}
            onMouseLeave={handleMouseLeave}
          >
            null
          </span>
        );
      }

      if (typeof actualValue === "string") {
        return (
          <span
            className="text-green-600 cursor-help hover:bg-yellow-100 px-1 rounded"
            onMouseEnter={(e) => handleMouseEnter(e, currentPath, source)}
            onMouseLeave={handleMouseLeave}
          >
            "{actualValue}"
          </span>
        );
      }

      if (typeof actualValue === "number") {
        return (
          <span
            className="text-blue-600 cursor-help hover:bg-yellow-100 px-1 rounded"
            onMouseEnter={(e) => handleMouseEnter(e, currentPath, source)}
            onMouseLeave={handleMouseLeave}
          >
            {actualValue}
          </span>
        );
      }

      if (typeof actualValue === "boolean") {
        return (
          <span
            className="text-purple-600 cursor-help hover:bg-yellow-100 px-1 rounded"
            onMouseEnter={(e) => handleMouseEnter(e, currentPath, source)}
            onMouseLeave={handleMouseLeave}
          >
            {actualValue.toString()}
          </span>
        );
      }

      if (Array.isArray(actualValue)) {
        return (
          <div>
            <span
              className="cursor-help hover:bg-yellow-100 px-1 rounded"
              onMouseEnter={(e) => handleMouseEnter(e, currentPath, source)}
              onMouseLeave={handleMouseLeave}
            >
              [
            </span>
            <div className="pl-4">
              {actualValue.map((item, index) => (
                <div key={index} className="flex">
                  <span className="text-gray-500 mr-2">{index}:</span>
                  {renderValue(item, `${currentPath}[${index}]`)}
                  {index < actualValue.length - 1 && <span>,</span>}
                </div>
              ))}
            </div>
            <span>]</span>
          </div>
        );
      }

      // For objects, render without wrapping since children will have their own provenance
      return renderValue(actualValue, currentPath);
    }

    // Handle binary file objects
    if (val && typeof val === "object" && val._type === "file" && val._link) {
      const metadata = val._metadata || {};
      return (
        <div className="inline-flex items-center space-x-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            <a
              href={val._link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 font-medium text-sm underline"
              title={`Download ${metadata.originalName} (${metadata.mimeType})`}
            >
              {metadata.originalName || 'Download File'}
            </a>
          </div>
          <div className="text-xs text-gray-500">
            {metadata.size ? `${Math.round(metadata.size / 1024)}KB` : ''}
            {metadata.mimeType && metadata.size ? ' • ' : ''}
            {metadata.mimeType ? metadata.mimeType.split('/')[1]?.toUpperCase() : ''}
          </div>
        </div>
      );
    }

    // Handle regular objects (without provenance)
    if (val && typeof val === "object" && !Array.isArray(val)) {
      return (
        <div>
          <span>{`{`}</span>
          <div className="pl-4">
            {Object.entries(val).map(([key, value], index, arr) => (
              <div key={key} className="flex">
                <span className="text-gray-700 font-medium mr-2">"{key}":</span>
                {renderValue(
                  value,
                  currentPath ? `${currentPath}.${key}` : key,
                )}
                {index < arr.length - 1 && <span>,</span>}
              </div>
            ))}
          </div>
          <span>{`}`}</span>
        </div>
      );
    }

    // Handle arrays without provenance
    if (Array.isArray(val)) {
      return (
        <div>
          <span>[</span>
          <div className="pl-4">
            {val.map((item, index) => (
              <div key={index} className="flex">
                <span className="text-gray-500 mr-2">{index}:</span>
                {renderValue(item, `${currentPath}[${index}]`)}
                {index < val.length - 1 && <span>,</span>}
              </div>
            ))}
          </div>
          <span>]</span>
        </div>
      );
    }

    // Handle primitives without provenance
    if (val === null) {
      return <span className="text-gray-400">null</span>;
    }

    if (typeof val === "string") {
      return <span className="text-green-600">"{val}"</span>;
    }

    if (typeof val === "number") {
      return <span className="text-blue-600">{val}</span>;
    }

    if (typeof val === "boolean") {
      return <span className="text-purple-600">{val.toString()}</span>;
    }

    return <span>{String(val)}</span>;
  };

  return <div className="relative">{renderValue(value, path)}</div>;
};

const JSONViewer = ({ data, title, className = "" }) => {
  const [hoveredSource, setHoveredSource] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [showTooltip, setShowTooltip] = useState(false);

  const handleHover = (path, source) => {
    setHoveredSource(source);
    setShowTooltip(true);
  };

  const handleHoverEnd = () => {
    setShowTooltip(false);
    setHoveredSource(null);
  };

  const handleMouseMove = (e) => {
    setTooltipPosition({ x: e.clientX, y: e.clientY });
  };

  if (!data) {
    return (
      <div className={`p-4 text-center text-gray-500 ${className}`}>
        No data to display
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} onMouseMove={handleMouseMove}>
      {title && (
        <h3 className="text-lg font-medium text-gray-900 mb-4">{title}</h3>
      )}

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 font-mono text-sm overflow-auto max-h-96">
        <JSONValue
          value={data}
          onHover={handleHover}
          onHoverEnd={handleHoverEnd}
        />
      </div>

      <ProvenanceTooltip
        source={hoveredSource}
        isVisible={showTooltip}
        position={tooltipPosition}
      />

      {title && (
        <div className="mt-2 text-xs text-gray-500">
          💡 Hover over values to see their source configuration
        </div>
      )}
    </div>
  );
};

export default JSONViewer;
