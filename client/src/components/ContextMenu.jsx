import React, { useEffect } from "react";
import {
  ClipboardIcon,
  MapIcon,
  DocumentDuplicateIcon,
} from "@heroicons/react/24/outline";

const ContextMenu = ({ x, y, onClose, items }) => {
  useEffect(() => {
    const handleClickOutside = () => onClose();
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("click", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  if (!items || items.length === 0 || x === undefined || y === undefined) return null;

  return (
    <div
      className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg py-1 min-w-48 transition-colors"
      style={{
        left: Math.min(x, window.innerWidth - 200),
        top: Math.min(y, window.innerHeight - 200),
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, index) => (
        <button
          key={index}
          onClick={() => {
            item.onClick();
            onClose();
          }}
          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 text-gray-700 dark:text-gray-200 transition-colors"
          disabled={item.disabled}
        >
          {item.icon && <item.icon className="w-4 h-4" />}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
};

export default ContextMenu;
