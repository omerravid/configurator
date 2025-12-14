import React, { useEffect, useRef, useState } from "react";
import {
  ClipboardIcon,
  MapIcon,
  DocumentDuplicateIcon,
} from "@heroicons/react/24/outline";

const ContextMenu = ({ x, y, onClose, items }) => {
  const menuRef = useRef(null);
  const [position, setPosition] = useState({ left: x, top: y });

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

  // Adjust position to prevent menu from going off-screen
  useEffect(() => {
    if (menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedX = x;
      let adjustedY = y;

      // Adjust horizontal position if menu goes off right edge
      if (x + menuRect.width > viewportWidth) {
        adjustedX = viewportWidth - menuRect.width - 10; // 10px margin
      }

      // Adjust vertical position if menu goes off bottom edge
      if (y + menuRect.height > viewportHeight) {
        adjustedY = viewportHeight - menuRect.height - 10; // 10px margin
      }

      // Ensure minimum positioning (don't go negative)
      adjustedX = Math.max(10, adjustedX);
      adjustedY = Math.max(10, adjustedY);

      setPosition({ left: adjustedX, top: adjustedY });
    }
  }, [x, y, items]);

  if (!items || items.length === 0 || x === undefined || y === undefined) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg py-1 min-w-48 transition-colors"
      style={{
        left: `${position.left}px`,
        top: `${position.top}px`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, index) => (
        <button
          key={index}
          onClick={() => {
            if (!item.disabled) {
              item.onClick();
              onClose();
            }
          }}
          disabled={item.disabled}
          className={`w-full px-3 py-2 text-left text-sm flex items-center space-x-2 transition-colors ${
            item.disabled
              ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
              : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          {item.icon && <item.icon className="w-4 h-4" />}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
};

export default ContextMenu;
