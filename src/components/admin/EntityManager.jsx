import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Loader2, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import MediaUpload from '@/components/admin/MediaUpload';
import { cn } from '@/lib/utils';

export default function EntityManager({ entityName, label, fields, itemTitle, sort = '-created_date' }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null closed; {} new; record edit
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = () => {
    setLoading(true);
    base44.entities[entityName].list(sort, 200)
      .then((r) => { setItems(r || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, [entityName]);

  const openNew = () => {
    const blank = {};
    fields.forEach((f) => { blank[f.key] = f.type === 'boolean' ? false : f.type === 'number' ? 0 : ''; });
    setEditing(blank);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {};
      fields.forEach((f) => {
        let v = editing[f.key];
        if (f.type === 'number') v = v === '' ? 0 : Number(v);
        if (v !== undefined) payload[f.key] = v;
      });
      if (editing.id) {
        await base44.entities[entityName].update(editing.id, payload);
      } else {
        await base44.entities[entityName].create(payload);
      }
      setEditing(null);
      load();
    } catch (e) {
      console.error(e);
      alert('保存失败：' + (e.message || '未知错误'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (rec) => {
    try {
      await base44.entities[entityName].delete(rec.id);
      setConfirmDelete(null);
      load();
    } catch (e) {
      alert('删除失败：' + (e.message || '未知错误'));
    }
  };

  const setField = (key, val) => setEditing((s) => ({ ...s, [key]: val }));

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="font-mono-date text-xs text-muted-foreground">{label} · {items.length} 条</p>
        <Button size="sm" onClick={openNew} className="gap-1.5">
          <Plus size={15} /> 新增
        </Button>
      </div>

      <div className="mt-4 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            暂无内容，点击右上角「新增」添加
          </div>
        ) : (
          items.map((it) => (
            <div key={it.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{itemTitle ? itemTitle(it) : it.title || it.name || it.question || '未命名'}</p>
                {(it.date || it.category || it.level) && (
                  <p className="mt-0.5 font-mono-date text-xs text-muted-foreground">
                    {[it.date, it.category, it.level].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                <button onClick={() => setEditing(it)} className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
                  <Pencil size={15} />
                </button>
                <button onClick={() => setConfirmDelete(it)} className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit / New dialog */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 p-4 sm:p-8" onClick={() => setEditing(null)}>
          <div className="w-full max-w-lg rounded-xl border border-border bg-background shadow-xl animate-fade-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h3 className="font-display text-lg font-semibold">{editing.id ? '编辑' : '新增'}{label}</h3>
              <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-5">
              {fields.map((f) => (
                <div key={f.key}>
                  {f.type !== 'boolean' && <Label className="mb-1.5 block text-sm font-medium">{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>}
                  {f.type === 'text' && <Input value={editing[f.key] || ''} onChange={(e) => setField(f.key, e.target.value)} placeholder={f.placeholder} />}
                  {f.type === 'textarea' && <Textarea value={editing[f.key] || ''} rows={f.rows || 4} onChange={(e) => setField(f.key, e.target.value)} placeholder={f.placeholder} />}
                  {f.type === 'date' && <Input type="date" value={editing[f.key] || ''} onChange={(e) => setField(f.key, e.target.value)} />}
                  {f.type === 'number' && <Input type="number" value={editing[f.key] ?? 0} onChange={(e) => setField(f.key, e.target.value)} />}
                  {f.type === 'select' && (
                    <Select value={editing[f.key] || ''} onValueChange={(v) => setField(f.key, v)}>
                      <SelectTrigger><SelectValue placeholder="选择..." /></SelectTrigger>
                      <SelectContent>
                        {f.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                  {f.type === 'boolean' && (
                    <div className="flex items-center gap-2">
                      <Switch checked={!!editing[f.key]} onCheckedChange={(v) => setField(f.key, v)} />
                      <span className="text-sm text-muted-foreground">{f.label}</span>
                    </div>
                  )}
                  {f.type === 'image' && <MediaUpload value={editing[f.key] || ''} onChange={(v) => setField(f.key, v)} type="image" />}
                  {f.type === 'file' && <MediaUpload value={editing[f.key] || ''} onChange={(v) => setField(f.key, v)} type="file" />}
                  {f.type === 'video' && <MediaUpload value={editing[f.key] || ''} onChange={(v) => setField(f.key, v)} type="video" />}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
              <Button variant="outline" onClick={() => setEditing(null)}>取消</Button>
              <Button onClick={save} disabled={saving} className="gap-1.5">
                {saving && <Loader2 size={15} className="animate-spin" />} 保存
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4" onClick={() => setConfirmDelete(null)}>
          <div className="w-full max-w-sm rounded-xl border border-border bg-background p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-base font-semibold">确认删除？</h3>
            <p className="mt-2 text-sm text-muted-foreground">此操作不可撤销，确定删除「{itemTitle ? itemTitle(confirmDelete) : '该记录'}」吗？</p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmDelete(null)}>取消</Button>
              <Button variant="destructive" onClick={() => remove(confirmDelete)}>删除</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}