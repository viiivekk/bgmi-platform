"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Trophy } from "lucide-react";

const links = [{ href: "/", text: "Home" }, { href: "/tournaments/", text: "Tournaments" }, { href: "/archive/", text: "Archive" }];
export function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3" aria-label="Main">
        <Link href="/" className="flex items-center gap-2 font-semibold"><Trophy className="h-5 w-5 text-blue" aria-hidden />Esports platform</Link>
        <ul className="flex gap-4 text-sm">
          {links.map((l) => <li key={l.href}><Link href={l.href} aria-current={path === l.href ? "page" : undefined} className={path === l.href ? "text-white" : "text-mute hover:text-white"}>{l.text}</Link></li>)}
        </ul>
      </nav>
    </header>
  );
}
