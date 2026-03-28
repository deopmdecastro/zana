import React from 'react';
import { Trash2 } from 'lucide-react';

import { cn } from '@/lib/utils';

export default function DeleteIcon({ className, ...props }) {
  return <Trash2 className={cn('w-3.5 h-3.5', className)} {...props} />;
}

