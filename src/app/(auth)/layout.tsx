// Force all auth pages to be dynamically rendered (not prerendered during build)
// This prevents build failures when env vars aren't available at build time
export const dynamic = 'force-dynamic';

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
