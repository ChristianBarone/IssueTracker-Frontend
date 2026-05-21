'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getStoredApiKey } from '../lib/auth';
import {
    fetchEntities, createEntity, updateEntity, deleteEntity,
    moveEntityUp, moveEntityDown,
    EntityType, AnyEntity, StatusEntity, DueDateEntity, OrderedDefaultEntity,
} from './settingsService';

// ─── Config ──────────────────────────────────────────────────────────────────

type EntityConfig = {
    label: string;
    singular: string;
    description: string;
    hasOrder: boolean;
    hasDefault: boolean;
    hasClosed: boolean;
    hasDaysOffset: boolean;
    needsReplacement: boolean;
};

const ENTITY_TYPES: EntityType[] = ['statuses', 'priorities', 'types', 'severities', 'tags', 'due-dates'];

const ENTITY_CONFIGS: Record<EntityType, EntityConfig> = {
    statuses: {
        label: 'Statuses', singular: 'Status',
        description: 'Add, remove or edit the color and name of the statuses your issues will go through.',
        hasOrder: true, hasDefault: true, hasClosed: true, hasDaysOffset: false, needsReplacement: true,
    },
    priorities: {
        label: 'Priorities', singular: 'Priority',
        description: 'Specify the priorities your issues will have',
        hasOrder: true, hasDefault: true, hasClosed: false, hasDaysOffset: false, needsReplacement: true,
    },
    types: {
        label: 'Types', singular: 'Type',
        description: 'Specify the types your issues could be',
        hasOrder: true, hasDefault: true, hasClosed: false, hasDaysOffset: false, needsReplacement: true,
    },
    severities: {
        label: 'Severities', singular: 'Severity',
        description: 'Specify the severities your issues will have',
        hasOrder: true, hasDefault: true, hasClosed: false, hasDaysOffset: false, needsReplacement: true,
    },
    tags: {
        label: 'Tags', singular: 'Tag',
        description: 'Manage the tags you can assign to issues',
        hasOrder: false, hasDefault: false, hasClosed: false, hasDaysOffset: false, needsReplacement: false,
    },
    'due-dates': {
        label: 'Due Dates', singular: 'Due Date',
        description: 'Specify the due dates status your issues will go through if selected',
        hasOrder: true, hasDefault: false, hasClosed: false, hasDaysOffset: true, needsReplacement: false,
    },
};

// ─── Form helpers ─────────────────────────────────────────────────────────────

interface FormState {
    name: string;
    color: string;
    is_closed: boolean;
    is_default: boolean;
    days_offset: string;
    before_or_after: 'before' | 'after';
}

const DEFAULT_FORM: FormState = {
    name: '', color: '#5dc5b5', is_closed: false, is_default: false,
    days_offset: '0', before_or_after: 'before',
};

function itemToForm(item: AnyEntity): FormState {
    const s = item as StatusEntity;
    const d = item as DueDateEntity;
    const od = item as OrderedDefaultEntity;
    return {
        name: item.name,
        color: item.color || '#5dc5b5',
        is_closed: s.is_closed ?? false,
        is_default: od.is_default ?? false,
        days_offset: d.days_offset != null ? String(d.days_offset) : '0',
        before_or_after: d.before_or_after ?? 'before',
    };
}

function formToData(form: FormState, config: EntityConfig): Record<string, unknown> {
    const data: Record<string, unknown> = { name: form.name, color: form.color };
    if (config.hasClosed) data.is_closed = form.is_closed;
    if (config.hasDefault) data.is_default = form.is_default;
    if (config.hasDaysOffset) {
        data.days_offset = parseInt(form.days_offset, 10) || 0;
        data.before_or_after = form.before_or_after;
    }
    return data;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type AllItems = Record<EntityType, AnyEntity[]>;

type EditModal = { mode: 'create' } | { mode: 'edit'; item: AnyEntity } | null;
type DeleteModal = { item: AnyEntity; replacementId: number | null } | null;

export default function SettingsPage() {
    const apiKey = getStoredApiKey();

    const [allItems, setAllItems] = useState<AllItems>(
        () => Object.fromEntries(ENTITY_TYPES.map(e => [e, []])) as unknown as AllItems
    );
    const [activeTab, setActiveTab] = useState<EntityType>('statuses');
    const [loading, setLoading] = useState(true);
    const [pageError, setPageError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const [editModal, setEditModal] = useState<EditModal>(null);
    const [formData, setFormData] = useState<FormState>(DEFAULT_FORM);
    const [modalError, setModalError] = useState<string | null>(null);

    const [deleteModal, setDeleteModal] = useState<DeleteModal>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const items = allItems[activeTab];
    const config = ENTITY_CONFIGS[activeTab];

    // Load all entities in parallel so tab counts are always visible
    const loadAll = useCallback(async () => {
        if (!apiKey) return;
        setLoading(true);
        setPageError(null);
        try {
            const pairs = await Promise.all(
                ENTITY_TYPES.map(e => fetchEntities(e, apiKey).then(data => [e, data] as const))
            );
            setAllItems(Object.fromEntries(pairs) as AllItems);
        } catch {
            setPageError('Failed to load settings. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [apiKey]);

    const reloadCurrent = useCallback(async () => {
        if (!apiKey) return;
        const data = await fetchEntities(activeTab, apiKey);
        setAllItems(prev => ({...prev, [activeTab]: data}));
    }, [activeTab, apiKey]);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    // ── Move up / down ────────────────────────────────────────────────────────

    const handleMoveUp = async (id: number) => {
        if (!apiKey || busy) return;
        setBusy(true);
        await moveEntityUp(activeTab, id, apiKey);
        await reloadCurrent();
        setBusy(false);
    };

    const handleMoveDown = async (id: number) => {
        if (!apiKey || busy) return;
        setBusy(true);
        await moveEntityDown(activeTab, id, apiKey);
        await reloadCurrent();
        setBusy(false);
    };

    // ── Toggle is_closed ──────────────────────────────────────────────────────

    const handleToggleClosed = async (item: StatusEntity) => {
        if (!apiKey || busy) return;
        setBusy(true);
        await updateEntity('statuses', item.id, {
            name: item.name,
            color: item.color,
            is_closed: !item.is_closed,
            is_default: item.is_default,
        }, apiKey);
        await reloadCurrent();
        setBusy(false);
    };

    // ── Edit / Create modal ───────────────────────────────────────────────────

    const openCreateModal = () => {
        setFormData(DEFAULT_FORM);
        setModalError(null);
        setEditModal({mode: 'create'});
    };

    const openEditModal = (item: AnyEntity) => {
        setFormData(itemToForm(item));
        setModalError(null);
        setEditModal({mode: 'edit', item});
    };

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!apiKey || !editModal) return;
        setModalError(null);
        setBusy(true);

        const data = formToData(formData, config);
        const result = editModal.mode === 'create'
            ? await createEntity(activeTab, data, apiKey)
            : await updateEntity(activeTab, editModal.item.id, data, apiKey);

        if (result.ok) {
            setEditModal(null);
            await reloadCurrent();
        } else {
            setModalError(result.error ?? 'Error saving. Try again.');
        }
        setBusy(false);
    };

    // ── Delete modal ──────────────────────────────────────────────────────────

    const openDeleteModal = (item: AnyEntity) => {
        const others = items.filter(i => i.id !== item.id);
        setDeleteError(null);
        setDeleteModal({item, replacementId: others.length > 0 ? others[0].id : null});
    };

    const handleConfirmDelete = async () => {
        if (!apiKey || !deleteModal) return;
        setDeleteError(null);
        setBusy(true);

        const result = await deleteEntity(
            activeTab,
            deleteModal.item.id,
            apiKey,
            config.needsReplacement ? (deleteModal.replacementId ?? undefined) : undefined
        );

        if (result.ok) {
            setDeleteModal(null);
            await reloadCurrent();
        } else {
            setDeleteError(result.error ?? 'Error deleting. Try again.');
        }
        setBusy(false);
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div
            className="min-h-screen px-4 py-6 text-slate-700 md:px-8"
            style={{
                fontFamily: '"Ubuntu", "Segoe UI", sans-serif',
                backgroundImage:
                    'radial-gradient(circle at top left, rgba(47, 147, 184, 0.12), transparent 30%), ' +
                    'radial-gradient(circle at top right, rgba(93, 197, 181, 0.12), transparent 26%)',
                backgroundColor: '#f5f7fb',
            }}
        >
            <div className="mx-auto w-full max-w-[1100px]">

                {/* Page header */}
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-[28px] font-bold text-slate-900">Settings</h1>
                        <p className="mt-1 text-sm text-slate-500">Manage project configuration values</p>
                    </div>
                    <Link
                        href="/issues"
                        className="inline-flex items-center gap-2 rounded-[10px] bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 shadow-[0_4px_0_#cbd5e1] transition-transform hover:-translate-y-px cursor-pointer"
                    >
                        ← Back to Issues
                    </Link>
                </div>

                {pageError && (
                    <div className="mb-4 rounded-[12px] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                        {pageError}
                        <button
                            onClick={loadAll}
                            className="ml-3 font-bold underline hover:no-underline cursor-pointer"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {/* Main card */}
                <div
                    className="overflow-hidden rounded-[18px] border border-slate-200/90 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.08)]">

                    {/* Tabs */}
                    <div className="flex overflow-x-auto border-b border-slate-200 bg-[#fbfcfe]">
                        {ENTITY_TYPES.map(entity => {
                            const cfg = ENTITY_CONFIGS[entity];
                            const count = allItems[entity].length;
                            const isActive = activeTab === entity;
                            return (
                                <button
                                    key={entity}
                                    onClick={() => setActiveTab(entity)}
                                    className={`inline-flex shrink-0 items-center whitespace-nowrap border-r border-slate-200 px-5 py-4 text-sm font-bold transition-colors cursor-pointer ${
                                        isActive
                                            ? 'bg-white text-slate-800 shadow-[inset_0_-3px_0_#2f93b8]'
                                            : 'text-slate-500 hover:bg-white/60 hover:text-slate-700'
                                    }`}
                                >
                                    {cfg.label}
                                    {!loading && (
                                        <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                                            isActive ? 'bg-[#e8f6fb] text-[#1784a8]' : 'bg-slate-100 text-slate-500'
                                        }`}>
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Content */}
                    <div className="p-6">

                        {/* Entity header */}
                        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                            <div>
                                <h2 className="text-[18px] font-bold uppercase tracking-wider text-slate-900">
                                    {config.label}
                                </h2>
                                <p className="mt-1 max-w-xl text-sm text-slate-500">{config.description}</p>
                            </div>
                            <button
                                onClick={openCreateModal}
                                className="inline-flex shrink-0 items-center gap-2 rounded-[10px] bg-gradient-to-b from-[#82e9de] to-[#59d8cc] px-4 py-2.5 text-sm font-bold text-slate-900 shadow-[0_6px_0_#40bbb1] transition-transform hover:-translate-y-px cursor-pointer"
                            >
                                + ADD NEW {config.singular.toUpperCase()}
                            </button>
                        </div>

                        {/* Table area */}
                        {loading ? (
                            <div className="py-14 text-center text-slate-400">Loading settings…</div>
                        ) : items.length === 0 ? (
                            <div
                                className="rounded-[14px] border border-slate-200 bg-slate-50 py-12 text-center text-slate-400">
                                No {config.label.toLowerCase()} yet. Add one above.
                            </div>
                        ) : (
                            <div className="overflow-hidden rounded-[12px] border border-slate-200">
                                <table className="w-full text-sm">
                                    <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50">
                                        {config.hasOrder && (
                                            <th className="w-20 px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                                Order
                                            </th>
                                        )}
                                        <th className="w-14 px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                            Color
                                        </th>
                                        <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                            Name
                                        </th>
                                        {activeTab === 'statuses' && (
                                            <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                                Slug
                                            </th>
                                        )}
                                        {activeTab === 'statuses' && (
                                            <th className="w-24 px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                                Closed
                                            </th>
                                        )}
                                        {config.hasDefault && (
                                            <th className="w-24 px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                                Default
                                            </th>
                                        )}
                                        {activeTab === 'due-dates' && (
                                            <th className="w-20 px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                                Days
                                            </th>
                                        )}
                                        {activeTab === 'due-dates' && (
                                            <th className="w-28 px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                                Timing
                                            </th>
                                        )}
                                        <th className="w-32 px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                            Actions
                                        </th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {items.map((item, idx) => {
                                        const statusItem = item as StatusEntity;
                                        const dueDateItem = item as DueDateEntity;
                                        const defaultItem = item as OrderedDefaultEntity;
                                        const isFirst = idx === 0;
                                        const isLast = idx === items.length - 1;
                                        const canDelete = !config.needsReplacement || items.length > 1;

                                        return (
                                            <tr
                                                key={item.id}
                                                className="border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50/50"
                                            >
                                                {config.hasOrder && (
                                                    <td className="px-4 py-3">
                                                        <div className="flex gap-0.5">
                                                            <button
                                                                onClick={() => handleMoveUp(item.id)}
                                                                disabled={isFirst || busy}
                                                                className="rounded-[6px] p-1.5 text-[11px] text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-20 cursor-pointer"
                                                                title="Move up"
                                                            >
                                                                ▲
                                                            </button>
                                                            <button
                                                                onClick={() => handleMoveDown(item.id)}
                                                                disabled={isLast || busy}
                                                                className="rounded-[6px] p-1.5 text-[11px] text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-20 cursor-pointer"
                                                                title="Move down"
                                                            >
                                                                ▼
                                                            </button>
                                                        </div>
                                                    </td>
                                                )}
                                                <td className="px-4 py-3">
                                                        <span
                                                            className="inline-block h-6 w-6 rounded-[4px] border border-slate-200"
                                                            style={{backgroundColor: item.color || '#cbd5e1'}}
                                                        />
                                                </td>
                                                <td className="px-4 py-3 font-medium text-slate-800">
                                                    {item.name}
                                                </td>
                                                {activeTab === 'statuses' && (
                                                    <td className="px-4 py-3 font-mono text-xs text-slate-400">
                                                        {statusItem.slug || '—'}
                                                    </td>
                                                )}
                                                {activeTab === 'statuses' && (
                                                    <td className="px-4 py-3 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={!!statusItem.is_closed}
                                                            onChange={() => handleToggleClosed(statusItem)}
                                                            disabled={busy}
                                                            className="h-4 w-4 cursor-pointer accent-[#2f93b8]"
                                                            title="Toggle closed state"
                                                        />
                                                    </td>
                                                )}
                                                {config.hasDefault && (
                                                    <td className="px-4 py-3 text-center">
                                                        {defaultItem.is_default && (
                                                            <span
                                                                className="inline-flex items-center rounded-full bg-[#e8f6fb] px-2 py-0.5 text-[11px] font-bold text-[#1784a8]">
                                                                    Default
                                                                </span>
                                                        )}
                                                    </td>
                                                )}
                                                {activeTab === 'due-dates' && (
                                                    <td className="px-4 py-3 text-slate-600">
                                                        {dueDateItem.days_offset ?? '—'}
                                                    </td>
                                                )}
                                                {activeTab === 'due-dates' && (
                                                    <td className="px-4 py-3 capitalize text-slate-600">
                                                        {dueDateItem.before_or_after || '—'}
                                                    </td>
                                                )}
                                                <td className="px-4 py-3">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => openEditModal(item)}
                                                            className="rounded-[8px] bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-200 cursor-pointer"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={() => canDelete && openDeleteModal(item)}
                                                            disabled={!canDelete}
                                                            title={!canDelete ? 'Cannot delete the only remaining item' : undefined}
                                                            className="rounded-[8px] bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-500 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-30 cursor-pointer"
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Edit / Create Modal ──────────────────────────────────────────── */}
            {editModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div
                        className="w-full max-w-md rounded-[18px] border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
                        <h3 className="mb-5 text-[20px] font-bold text-slate-900">
                            {editModal.mode === 'create' ? `Add New ${config.singular}` : `Edit ${config.singular}`}
                        </h3>

                        <form onSubmit={handleSaveEdit} className="grid gap-4">
                            {modalError && (
                                <div
                                    className="rounded-[12px] border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                                    {modalError}
                                </div>
                            )}

                            <div>
                                <label
                                    className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                                    Name
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData(prev => ({...prev, name: e.target.value}))}
                                    className="w-full rounded-[10px] border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#2f93b8] focus:ring-2 focus:ring-[#2f93b8]/10"
                                    placeholder={`${config.singular} name`}
                                />
                            </div>

                            <div>
                                <label
                                    className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                                    Color
                                </label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        value={formData.color}
                                        onChange={e => setFormData(prev => ({...prev, color: e.target.value}))}
                                        className="h-10 w-16 cursor-pointer rounded-[8px] border border-slate-200 p-0.5"
                                    />
                                    <span className="font-mono text-sm text-slate-500">{formData.color}</span>
                                </div>
                            </div>

                            {config.hasClosed && (
                                <label
                                    className="flex cursor-pointer items-center gap-3 rounded-[10px] border border-slate-200 p-3 hover:bg-slate-50">
                                    <input
                                        type="checkbox"
                                        checked={formData.is_closed}
                                        onChange={e => setFormData(prev => ({...prev, is_closed: e.target.checked}))}
                                        className="h-4 w-4 accent-[#2f93b8]"
                                    />
                                    <div>
                                        <div className="text-sm font-semibold text-slate-700">Is Closed</div>
                                        <div className="text-xs text-slate-400">Issues with this status count as
                                            closed
                                        </div>
                                    </div>
                                </label>
                            )}

                            {config.hasDefault && (
                                <label
                                    className="flex cursor-pointer items-center gap-3 rounded-[10px] border border-slate-200 p-3 hover:bg-slate-50">
                                    <input
                                        type="checkbox"
                                        checked={formData.is_default}
                                        onChange={e => setFormData(prev => ({...prev, is_default: e.target.checked}))}
                                        className="h-4 w-4 accent-[#2f93b8]"
                                    />
                                    <div>
                                        <div className="text-sm font-semibold text-slate-700">Is Default</div>
                                        <div className="text-xs text-slate-400">Selected by default for new issues</div>
                                    </div>
                                </label>
                            )}

                            {config.hasDaysOffset && (
                                <>
                                    <div>
                                        <label
                                            className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                                            Days Offset
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={formData.days_offset}
                                            onChange={e => setFormData(prev => ({
                                                ...prev,
                                                days_offset: e.target.value
                                            }))}
                                            className="w-full rounded-[10px] border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#2f93b8] focus:ring-2 focus:ring-[#2f93b8]/10"
                                        />
                                    </div>
                                    <div>
                                        <label
                                            className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                                            Timing
                                        </label>
                                        <select
                                            value={formData.before_or_after}
                                            onChange={e => setFormData(prev => ({
                                                ...prev,
                                                before_or_after: e.target.value as 'before' | 'after',
                                            }))}
                                            className="w-full rounded-[10px] border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#2f93b8] cursor-pointer"
                                        >
                                            <option value="before">Before due date</option>
                                            <option value="after">After due date</option>
                                        </select>
                                    </div>
                                </>
                            )}

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setEditModal(null)}
                                    className="rounded-[10px] bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-200 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={busy}
                                    className="rounded-[10px] bg-gradient-to-b from-[#82e9de] to-[#59d8cc] px-5 py-2.5 text-sm font-bold text-slate-900 shadow-[0_4px_0_#40bbb1] transition-transform hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                                >
                                    {busy ? 'Saving…' : 'Save'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Delete Modal ─────────────────────────────────────────────────── */}
            {deleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div
                        className="w-full max-w-md rounded-[18px] border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
                        <h3 className="mb-1 text-[18px] font-bold text-slate-900">
                            Delete value: <span className="text-rose-500">{deleteModal.item.name}</span>
                        </h3>

                        {deleteError && (
                            <div
                                className="my-4 rounded-[12px] border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                                {deleteError}
                            </div>
                        )}

                        {config.needsReplacement && items.filter(i => i.id !== deleteModal.item.id).length > 0 ? (
                            <div className="mt-4 mb-5">
                                <p className="mb-4 text-sm text-slate-600">
                                    Issues currently using <strong>{deleteModal.item.name}</strong> will be
                                    reassigned to the selected replacement value.
                                </p>
                                <label
                                    className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                                    Replacement
                                </label>
                                <select
                                    value={deleteModal.replacementId ?? ''}
                                    onChange={e => setDeleteModal(prev =>
                                        prev ? {...prev, replacementId: Number(e.target.value)} : prev
                                    )}
                                    className="w-full rounded-[10px] border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#2f93b8] cursor-pointer"
                                >
                                    {items.filter(i => i.id !== deleteModal.item.id).map(i => (
                                        <option key={i.id} value={i.id}>{i.name}</option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <p className="mb-5 mt-3 text-sm text-slate-600">
                                Are you sure you want to permanently delete <strong>{deleteModal.item.name}</strong>?
                                This action cannot be undone.
                            </p>
                        )}

                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setDeleteModal(null)}
                                className="rounded-[10px] bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-200 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDelete}
                                disabled={busy}
                                className="rounded-[10px] bg-rose-500 px-5 py-2.5 text-sm font-bold text-white shadow-[0_4px_0_#fca5a5] transition-transform hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                            >
                                {busy ? 'Deleting…' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
