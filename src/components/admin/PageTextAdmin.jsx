import React, { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { api } from '@/api/client';
import { SITE_TEXT_DEFAULTS, SITE_TEXT_GROUPS } from '@/lib/siteText';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import MediaUpload from '@/components/admin/MediaUpload';

export default function PageTextAdmin() {
  const [record, setRecord] = useState(null);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.entities.SiteSettings.list()
      .then((rows) => {
        const current = rows[0] || {};
        setRecord(current);
        const custom = current.page_texts && typeof current.page_texts === 'object' ? current.page_texts : {};
        setValues({ ...SITE_TEXT_DEFAULTS, ...custom });
      })
      .catch(() => { setRecord({}); setValues({ ...SITE_TEXT_DEFAULTS }); });
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const payload = { page_texts: values };
      const saved = record.id
        ? await api.entities.SiteSettings.update(record.id, payload)
        : await api.entities.SiteSettings.create(payload);
      setRecord(saved);
      alert('页面文案保存成功');
    } catch (error) {
      alert(`保存失败：${error.message || '未知错误'}`);
    } finally {
      setSaving(false);
    }
  };

  if (!record) return <div className="flex justify-center py-10 text-muted-foreground"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="max-w-3xl space-y-8">
      <p className="text-sm leading-6 text-muted-foreground">未填写的项目会继续使用网站当前默认文字。修改后保存并刷新对应页面即可查看效果。</p>
      {SITE_TEXT_GROUPS.map((group) => (
        <section key={group.id} className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold text-foreground">{group.label}</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {group.fields.map(([key, label, defaultValue, type = 'text']) => (
              <div key={key} className={type === 'textarea' || type === 'image' ? 'sm:col-span-2' : undefined}>
                <Label className="mb-1.5 block text-sm font-medium">{label}</Label>
                {type === 'image' ? (
                  <MediaUpload type="image" value={values[key] ?? ''} onChange={(value) => setValues((current) => ({ ...current, [key]: value }))} />
                ) : type === 'textarea' ? (
                  <Textarea rows={String(defaultValue).includes('\n') ? 4 : 3} value={values[key] ?? ''} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} placeholder={defaultValue} />
                ) : (
                  <Input value={values[key] ?? ''} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} placeholder={defaultValue} />
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
      <Button onClick={save} disabled={saving} className="gap-1.5">
        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} 保存全部页面文案
      </Button>
    </div>
  );
}
