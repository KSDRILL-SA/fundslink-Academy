import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names, letting later Tailwind utilities win over earlier ones.
 *
 * `clsx` flattens conditionals; `twMerge` resolves conflicts within a Tailwind
 * group — so a caller passing `class="px-8"` overrides a variant's `px-4`
 * instead of both landing in the attribute and the winner being decided by
 * stylesheet order, which is invisible and depends on build output.
 *
 * Every component in libs/ui composes its classes through this, which is what
 * makes `class` a supported input rather than a thing that sometimes works.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
