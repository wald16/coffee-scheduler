"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Nav({ isAdmin }: { isAdmin: boolean }) {
    const path = usePathname();
    const items = [
        { href: "/mis-turnos", label: "Mis turnos" },
        ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
        { href: "/auth/signout", label: "Salir" },
    ];
    return (
        <div className="ig-topbar">
            <div className="ig-container py-3 flex items-center gap-3">
                <div className="text-[15px] font-semibold tracking-tight">Organizador</div>
                <nav className="ml-auto ig-pillnav">
                    {items.map((it) => (
                        <Link
                            key={it.href}
                            href={it.href}
                            data-active={path === it.href || undefined}
                        >
                            {it.label}
                        </Link>
                    ))}
                </nav>
            </div>
        </div>
    );
}
