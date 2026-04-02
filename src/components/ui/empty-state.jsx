import React from 'react';

export default function EmptyState({
  icon: Icon,
  title,
  description,
  className = '',
  iconClassName = '',
} = {}) {
  return (
    <div className={`text-center py-10 ${className}`.trim()}>
      {Icon ? <Icon className={`w-10 h-10 text-muted-foreground/30 mx-auto mb-2 ${iconClassName}`.trim()} /> : null}
      {title ? <p className="font-heading text-lg text-foreground/80">{title}</p> : null}
      {description ? <p className="font-body text-sm text-muted-foreground mt-1">{description}</p> : null}
    </div>
  );
}

