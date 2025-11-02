import { CheckSquare } from 'lucide-react';

export function Logo() {
  return (
    <div className="flex items-center gap-2" aria-label="ContentQA homepage">
      <CheckSquare className="w-8 h-8 text-primary" />
      <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">
        ContentQA
      </h1>
    </div>
  );
}
