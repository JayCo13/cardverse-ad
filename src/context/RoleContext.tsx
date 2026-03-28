"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Role = 'moderator' | 'admin' | null;

interface RoleContextType {
    role: Role;
    isModerator: boolean;
    isAdmin: boolean;
    isLoading: boolean;
}

const RoleContext = createContext<RoleContextType>({
    role: null,
    isModerator: false,
    isAdmin: false,
    isLoading: true,
});

export function RoleProvider({ children }: { children: ReactNode }) {
    const [role, setRole] = useState<Role>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchRole() {
            try {
                const res = await fetch('/api/auth/role');
                if (res.ok) {
                    const data = await res.json();
                    setRole(data.role);
                }
            } catch {
                // If fetch fails, role stays null
            } finally {
                setIsLoading(false);
            }
        }
        fetchRole();
    }, []);

    return (
        <RoleContext.Provider
            value={{
                role,
                isModerator: role === 'moderator',
                isAdmin: role === 'admin',
                isLoading,
            }}
        >
            {children}
        </RoleContext.Provider>
    );
}

export function useRole() {
    return useContext(RoleContext);
}
