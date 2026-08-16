import { Link, useLocation } from 'react-router-dom';
import { Home } from 'lucide-react';
import { useSiteText } from '@/lib/siteText';


export default function PageNotFound() {
    const location = useLocation();
    const text = useSiteText();
    const pageName = location.pathname.substring(1);

    return (
        <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background p-6">
            <div className="absolute inset-0 neural-grid opacity-40" />
            <div className="relative w-full max-w-md">
                <div className="space-y-7 text-center">
                    <div className="space-y-3">
                        <h1 className="font-mono-date text-7xl font-light tracking-[-0.05em] text-primary/20">404</h1>
                        <div className="mx-auto h-px w-14 bg-primary/25" />
                    </div>

                    <div className="space-y-3">
                        <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">
                            {text('not_found_title')}
                        </h2>
                        <p className="leading-7 text-muted-foreground">
                            {text('not_found_description')} <span className="font-medium text-foreground/80">&ldquo;{pageName}&rdquo;</span>
                        </p>
                    </div>

                    <div className="pt-4">
                        <Link
                            to="/"
                            className="inline-flex h-10 items-center gap-2 rounded-full bg-amber px-5 text-sm font-semibold text-amber-foreground shadow-[0_8px_24px_hsl(var(--amber)/0.16)] transition-[background-color,transform] duration-200 hover:-translate-y-0.5 hover:bg-amber/80 active:translate-y-px"
                        >
                            <Home size={15} strokeWidth={1.8} />
                            {text('not_found_button')}
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
