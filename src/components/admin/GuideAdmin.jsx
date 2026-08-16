import React, { useCallback, useMemo, useState } from 'react';
import EntityManager from '@/components/admin/EntityManager';

const stageFields = [
  { key: 'title', label: '阶段名称', type: 'text', required: true, placeholder: '如：Stage 0' },
  { key: 'subtitle', label: '阶段说明', type: 'text', placeholder: '如：自学与入门门槛' },
  { key: 'requirements', label: '阶段要求（每行一条）', type: 'textarea', rows: 5, placeholder: '掌握 Python、Conda 与 Linux 基本操作\n完成一个基础课程项目' },
  { key: 'order_index', label: '排序（小在前）', type: 'number' },
];

const categoryFields = [
  { key: 'title', label: '板块名称', type: 'text', required: true, placeholder: '如：机器学习与深度学习' },
  { key: 'description', label: '板块简介', type: 'textarea', rows: 2 },
  { key: 'icon', label: '板块图标', type: 'select', options: [
    { value: 'code', label: '代码工程' },
    { value: 'vision', label: '计算机视觉' },
    { value: 'brain', label: '机器学习' },
    { value: 'gamepad', label: '强化学习' },
    { value: 'settings', label: '仿真与工具' },
  ] },
  { key: 'order_index', label: '排序（小在前）', type: 'number' },
];

export default function GuideAdmin() {
  const [categories, setCategories] = useState([]);
  const handleCategoriesChange = useCallback((items) => setCategories(items), []);
  const categoryOptions = useMemo(
    () => categories.map((category) => ({ value: category.id, label: category.title })),
    [categories]
  );
  const courseFields = useMemo(() => [
    { key: 'category_id', label: '所属资源板块', type: 'select', required: true, options: categoryOptions, helper: categoryOptions.length ? '课程会显示在所选板块中。' : '请先新增一个资源板块。' },
    { key: 'title', label: '课程名称', type: 'text', required: true },
    { key: 'description', label: '课程简介', type: 'textarea', rows: 4 },
    { key: 'image_url', label: '课程封面', type: 'image' },
    { key: 'primary_link_label', label: '主要链接名称', type: 'text', placeholder: '如：访问课程' },
    { key: 'primary_url', label: '主要链接', type: 'text', placeholder: 'https://...' },
    { key: 'secondary_link_label', label: '第二链接名称', type: 'text', placeholder: '如：课程讲义' },
    { key: 'secondary_url', label: '第二链接', type: 'text', placeholder: 'https://...' },
    { key: 'order_index', label: '排序（小在前）', type: 'number' },
  ], [categoryOptions]);

  return (
    <div className="space-y-12">
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground">学习路径</h2>
        <p className="mt-1 text-sm text-muted-foreground">管理页面顶部的阶段卡片与阶段要求。</p>
        <div className="mt-5">
          <EntityManager entityName="GuideStage" label="学习阶段" fields={stageFields} sort="order_index" itemTitle={(item) => item.title} />
        </div>
      </section>

      <section className="border-t border-border pt-10">
        <h2 className="font-display text-lg font-semibold text-foreground">学习资源板块</h2>
        <p className="mt-1 text-sm text-muted-foreground">新增代码工程、机器学习或其他资源分类。</p>
        <div className="mt-5">
          <EntityManager entityName="GuideCategory" label="资源板块" fields={categoryFields} sort="order_index" itemTitle={(item) => item.title} onItemsChange={handleCategoriesChange} />
        </div>
      </section>

      <section className="border-t border-border pt-10">
        <h2 className="font-display text-lg font-semibold text-foreground">板块课程</h2>
        <p className="mt-1 text-sm text-muted-foreground">在已有板块中添加课程、封面、简介和访问链接。</p>
        <div className="mt-5">
          <EntityManager entityName="GuideCourse" label="课程" fields={courseFields} sort="order_index" itemTitle={(item) => item.title} />
        </div>
      </section>
    </div>
  );
}
