import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export function Button({ 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  ...props 
}: ButtonProps) {
  const baseStyles = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-accent text-white shadow hover:bg-accent-hover active:scale-[0.98]",
    secondary: "bg-panel text-ink border border-border hover:bg-bg active:scale-[0.98]",
    outline: "border border-border bg-transparent hover:bg-panel hover:text-accent active:scale-[0.98]",
    ghost: "hover:bg-panel hover:text-accent active:scale-[0.98]",
    danger: "bg-red-600 text-white shadow-sm hover:bg-red-700 active:scale-[0.98]",
  };

  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-9 px-4 py-2 text-sm",
    lg: "h-10 px-8 text-base",
    icon: "h-9 w-9",
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}
