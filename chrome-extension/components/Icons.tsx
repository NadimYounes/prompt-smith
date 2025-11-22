import React from 'react';

interface IconProps {
  className?: string;
}

export const FeatherLogo: React.FC<IconProps> = ({ className }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="white" 
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M21.41 2.59a2.01 2.01 0 0 0-2.83 0L10 11.17v5.83h5.83l8.58-8.58a2.01 2.01 0 0 0 0-2.83l-2.99-3M8.5 13.5A1.5 1.5 0 0 1 7 15H4a1 1 0 0 0-1 1v5h5a1 1 0 0 0 1-1v-3a1.5 1.5 0 0 1 1.5-1.5 1.5 1.5 0 0 1 1.5 1.5V22h-9v-5.5a2.5 2.5 0 0 1 2.5-2.5h2.5c.28 0 .5.22.5.5z" />
  </svg>
);