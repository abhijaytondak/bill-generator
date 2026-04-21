"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Building2 } from "lucide-react";
import { z } from "zod";
import type { Category, Vendor } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";
import { deleteVendor, generateVendorId, getVendors, saveVendor } from "@/lib/vendors";
import { isValidGSTIN, stateFromGSTIN } from "@/lib/gstin";

type Props = {
  category: Category;
  selectedId: string | null;
  onSelect: (vendor: Vendor | null) => void;
  suggestedName?: string | null;
};

export function VendorPicker({ category, selectedId, onSelect, suggestedName }: Props) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [adding, setAdding] = useState(false);

  const refresh = () => setVendors(getVendors().filter((v) => v.category === category));
  useEffect(refresh, [category]);

  const filtered = vendors;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs uppercase tracking-wider text-neutral-500 font-medium">
          Vendor ({CATEGORY_LABELS[category]})
        </label>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 text-xs text-neutral-700 hover:text-black"
        >
          <Plus className="w-3 h-3" /> New vendor
        </button>
      </div>

      {filtered.length === 0 && !adding ? (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-center text-sm text-neutral-500">
          No saved vendors for this category yet.
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="ml-1 text-black underline hover:opacity-80"
          >
            Add one
          </button>
          .
        </div>
      ) : null}

      {filtered.length > 0 ? (
        <div className="space-y-1.5">
          {filtered.map((v) => (
            <label
              key={v.id}
              className={`flex items-start gap-3 border rounded-lg p-3 cursor-pointer transition-colors
                ${selectedId === v.id ? "border-black bg-neutral-50" : "border-neutral-200 hover:border-neutral-400"}`}
            >
              <input
                type="radio"
                name="vendor"
                checked={selectedId === v.id}
                onChange={() => onSelect(v)}
                className="mt-1 accent-black"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                  <span className="font-medium text-sm truncate">{v.name}</span>
                </div>
                <div className="mt-0.5 text-xs text-neutral-500 truncate">
                  {v.gstin ? `GSTIN: ${v.gstin}` : "Unregistered under GST"}
                  {v.city ? ` · ${v.city}` : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (confirm(`Delete vendor "${v.name}"?`)) {
                    deleteVendor(v.id);
                    if (selectedId === v.id) onSelect(null);
                    refresh();
                  }
                }}
                className="p-1 rounded hover:bg-neutral-200 text-neutral-400 hover:text-red-600"
                title="Delete vendor"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </label>
          ))}
        </div>
      ) : null}

      {adding ? (
        <NewVendorForm
          category={category}
          suggestedName={suggestedName ?? undefined}
          onCancel={() => setAdding(false)}
          onSaved={(v) => {
            setAdding(false);
            refresh();
            onSelect(v);
          }}
        />
      ) : null}
    </div>
  );
}

function NewVendorForm({
  category,
  suggestedName,
  onCancel,
  onSaved,
}: {
  category: Category;
  suggestedName?: string;
  onCancel: () => void;
  onSaved: (v: Vendor) => void;
}) {
  const [name, setName] = useState(suggestedName ?? "");
  const [gstin, setGstin] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setStateVal] = useState("");
  const [pincode, setPincode] = useState("");
  const [phone, setPhone] = useState("");
  const [hsn, setHsn] = useState("");
  const [error, setError] = useState<string | null>(null);

  const gstinTrimmed = gstin.trim().toUpperCase();
  const gstinOk = gstinTrimmed === "" || isValidGSTIN(gstinTrimmed);
  const gstinDerivedState = gstinTrimmed.length >= 2 ? stateFromGSTIN(gstinTrimmed) : null;

  const submit = () => {
    setError(null);
    if (!name.trim()) {
      setError("Vendor name is required.");
      return;
    }
    if (gstinTrimmed && !isValidGSTIN(gstinTrimmed)) {
      setError("GSTIN format looks wrong. Leave blank if vendor is unregistered.");
      return;
    }
    const vendor: Vendor = {
      id: generateVendorId(),
      name: name.trim(),
      gstin: gstinTrimmed || undefined,
      address: address.trim() || undefined,
      city: city.trim() || undefined,
      state: (state || gstinDerivedState || "").trim() || undefined,
      pincode: pincode.trim() || undefined,
      phone: phone.trim() || undefined,
      hsnCode: hsn.trim() || undefined,
      category,
    };
    try {
      saveVendor(z.object({}).passthrough().parse(vendor) as Vendor);
      onSaved(vendor);
    } catch {
      setError("Could not save vendor.");
    }
  };

  return (
    <div className="rounded-lg border border-neutral-300 p-4 space-y-3 bg-white">
      <div className="text-sm font-medium">Add new vendor</div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Vendor name *" value={name} onChange={setName} placeholder="e.g. The Daily Cafe" />
        <Field label="Phone" value={phone} onChange={setPhone} placeholder="Optional" />
        <Field
          label="GSTIN"
          value={gstin}
          onChange={(v) => setGstin(v.toUpperCase())}
          placeholder="15-char (leave blank if unregistered)"
          className="col-span-2"
          invalid={!gstinOk}
          hint={
            gstinTrimmed && gstinOk && gstinDerivedState
              ? `State from GSTIN: ${gstinDerivedState}`
              : !gstinOk
              ? "Invalid GSTIN format"
              : "Enter only if you have a real bill showing this GSTIN"
          }
        />
        <Field label="Address" value={address} onChange={setAddress} className="col-span-2" />
        <Field label="City" value={city} onChange={setCity} />
        <Field label="State" value={state} onChange={setStateVal} placeholder={gstinDerivedState ?? "e.g. Haryana"} />
        <Field label="Pincode" value={pincode} onChange={setPincode} />
        <Field label="HSN/SAC code" value={hsn} onChange={setHsn} placeholder="Auto if blank" />
      </div>
      {error ? <div className="text-xs text-red-600">{error}</div> : null}
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-sm rounded-md border border-neutral-300 hover:bg-neutral-100"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          className="px-3 py-1.5 text-sm rounded-md bg-black text-white hover:bg-neutral-800"
        >
          Save vendor
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  className,
  invalid,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  invalid?: boolean;
  hint?: string;
}) {
  return (
    <div className={className}>
      <label className="text-xs text-neutral-600 font-medium">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`mt-1 w-full rounded-md border px-2.5 py-1.5 text-sm outline-none focus:border-black
          ${invalid ? "border-red-500" : "border-neutral-300"}`}
      />
      {hint ? (
        <div className={`mt-1 text-[11px] ${invalid ? "text-red-600" : "text-neutral-500"}`}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}
