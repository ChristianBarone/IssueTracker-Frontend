import React, {useEffect, useRef, useState} from "react";
import {AUTH_USERS} from "@/app/lib/auth";

export const AssigneeDropdown = ({ value, onChange, disabled, users }: { value: string, onChange: any, disabled?: boolean, users: typeof AUTH_USERS }) => {
    const [open, setOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement | null>(null);

    const currentLabel = (() => {
        if (!value) return 'Unassigned';
        const u = users.find(u => String(u.id) === String(value));
        return u ? u.username : 'Unassigned';
    })();

    const handleSelect = (val: string) => {
        onChange({ target: { value: val } });
        setOpen(false);
    };

    useEffect(() => {
        const onDoc = (e: MouseEvent) => {
            if (!open) return;
            if (buttonRef.current?.contains(e.target as Node)) return;
            setOpen(false);
        };
        document.addEventListener('click', onDoc);
        return () => document.removeEventListener('click', onDoc);
    }, [open]);

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                type="button"
                onClick={() => !disabled && setOpen(o => !o)}
                className={`flex justify-between items-stretch w-40 text-left font-sans text-xs px-2 py-1.5 border border-zinc-200 rounded outline-none bg-zinc-50/50 text-zinc-700 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
                <span>{currentLabel}</span>
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-40 bg-white border border-zinc-200 rounded-lg shadow-sm z-20 overflow-hidden">
                    <div
                        key={0}
                        onClick={() => handleSelect('')}
                        className={`px-3 py-2 text-sm cursor-pointer hover:bg-zinc-50 font-sans ${value == ''  ? 'bg-[#e8f7f6] text-[#2c3e50] font-semibold' : 'text-zinc-700'}`}
                    >
                        Unassigned
                    </div>
                    {users.map(u => (
                        <div
                            key={u.id}
                            onClick={() => handleSelect(String(u.id))}
                            className={`px-3 py-2 text-sm cursor-pointer hover:bg-zinc-50 font-sans ${String(u.id) === String(value) ? 'bg-[#e8f7f6] text-[#2c3e50] font-semibold' : 'text-zinc-700'}`}
                        >
                            {u.username}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};