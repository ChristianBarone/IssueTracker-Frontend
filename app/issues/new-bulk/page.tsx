'use client';

import React, { useState } from 'react';
import {createIssueBulk} from "@/app/issues/issueService";
import {useRouter} from "next/navigation";

export default function CreateIssuePage() {
    const router = useRouter();

    const [formData, setFormData] = useState({
        subjects: ''
    });

    const [loading, setLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ text: string; isError: boolean } | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e: React.SubmitEvent) => {
        e.preventDefault();
        setLoading(true);
        setStatusMessage(null);

        if (!formData.subjects.trim()) {
            setStatusMessage({ text: 'You must list at least one subject', isError: true });
            setLoading(false);
            return;
        }

        try {
            let list = formData.subjects.split("\n")
            list = list.filter((s) => s.trim() !== "")

            const response = await createIssueBulk(list)

            const data = await response.json().catch(() => ({}));

            if (response.ok) {
                setStatusMessage({ text: `Bulk issues created!`, isError: false });
            } else {
                console.error("Django error details:", data);
                setStatusMessage({
                    text: data.error || data.message || 'Unknown server error.',
                    isError: true
                });
            }
        } catch {
            setStatusMessage({ text: 'Backend connection error.', isError: true });
        } finally {
            setLoading(false);
            router.push('/issues');
        }
    };
    const handleCancel = () => {
        router.push('/issues');
    };

    return (
        <div className="min-h-screen bg-[#f4f7f9] text-[#333] font-sans flex flex-col items-center justify-start py-12 px-4">
            <div className="w-full max-w-5xl bg-white rounded-lg shadow-sm border border-zinc-200/60 p-8">

                {/* TÍTOL CENTRAL DE LA INTERFÍCIE */}
                <h1 className="text-center text-[28px] font-normal text-[#2c3e50] mb-8">
                    Bulk add issues
                </h1>

                {/* FEEDBACK */}
                {statusMessage && (
                    <div className={`p-4 mb-6 rounded-md text-sm font-medium border ${
                        statusMessage.isError
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                        {statusMessage.text}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="grid grid-cols-1">

                    {/* CONTINGUT */}
                    <div className="flex">
                        <textarea
                            name="subjects"
                            value={formData.subjects}
                            onChange={handleChange}
                            placeholder="List issue subjects, one per line..."
                            className="w-full px-4 py-3 rounded border border-[#a3dbc5] bg-white text-base outline-none focus:border-[#4db6ac] transition-colors"
                            rows={10}
                        />
                    </div>

                    {/* ACTIONS: CREATE I CANCEL */}
                    <div className="md:col-span-3 flex flex-col items-center gap-3 mt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full h-11 text-base font-medium uppercase tracking-wider rounded transition-colors cursor-pointer ${
                                loading
                                    ? 'bg-zinc-300 text-zinc-500 cursor-not-allowed'
                                    : 'bg-[#80cbd7] text-white hover:bg-[#4db6ac] shadow-sm'
                            }`}
                        >
                            {loading ? 'Creating...' : 'Create'}
                        </button>

                        <button
                            type="button"
                            onClick={handleCancel}
                            className="text-xs font-medium uppercase tracking-wider text-zinc-400 hover:text-zinc-600 transition-colors py-1 cursor-pointer"
                        >
                            Cancel
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}