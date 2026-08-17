import { useMemo } from 'react';
import { useSiteSettings } from '@/lib/site';

export const SITE_TEXT_GROUPS = [
  {
    id: 'global',
    label: '全站与导航',
    fields: [
      ['lab_name_cn', '实验室中文名称', '东华大学人工智能创新实验室'],
      ['lab_name_en', '实验室英文名称', 'AI Innovation Laboratory · AILAB'],
      ['nav_home', '导航：首页', '首页'], ['nav_team', '导航：团队', '团队'], ['nav_guide', '导航：AI入门', 'AI入门'],
      ['nav_notice', '导航：通知', '通知'], ['nav_awards', '导航：成果', '成果'], ['nav_activities', '导航：活动', '活动'],
      ['nav_club_life', '导航：社团生活', '社团生活'], ['nav_videos', '导航：视频', '视频'], ['nav_resources', '导航：资料', '资料'],
      ['nav_qa', '导航：问答', '问答'], ['nav_admin', '管理入口', '管理'], ['nav_join', '加入入口', '加入我们'],
      ['footer_slogan', '页脚简介', '人工智能创新实验室 — 探索智能前沿，编织学术未来。'],
      ['footer_nav_title', '页脚导航标题', '导航'], ['footer_contact_title', '页脚联系方式标题', '联系方式'],
      ['footer_members_label', '页脚成员统计', '成员'], ['footer_awards_label', '页脚成果统计', '成果'], ['footer_activities_label', '页脚活动统计', '活动'],
      ['footer_bilibili_default', '页脚B站默认名称', 'B站主页'], ['footer_qq_prefix', '页脚QQ群前缀', 'QQ群：'],
      ['footer_copyright_name', '版权名称', '东华大学人工智能创新实验室 AILAB'], ['footer_icp_number', 'ICP备案号', '蜀ICP备2026014434号-1'], ['footer_admin', '页脚管理入口', '管理后台'],
    ],
  },
  {
    id: 'home',
    label: '首页',
    fields: [
      ['home_eyebrow', '顶部英文小字', 'Donghua University · AILAB'],
      ['home_title', '主标题', '人工智能\n创新实验室', 'textarea'],
      ['home_intro_default', '默认简介', '探索智能前沿，编织学术未来。我们汇聚东华大学对人工智能充满热情的青年学者，以代码为梭，以算法为线，织就属于这个时代的智能图景。', 'textarea'],
      ['home_join_button', '加入按钮', '加入我们'], ['home_team_button', '了解团队按钮', '了解团队'],
      ['home_members_stat', '成员统计标题', '实验室成员'], ['home_awards_stat', '成果统计标题', '成果数量'], ['home_activities_stat', '活动统计标题', '社团活动'],
      ['home_members_unit', '成员统计单位', '人'], ['home_awards_unit', '成果统计单位', '项'], ['home_activities_unit', '活动统计单位', '场'],
      ['home_explore_eyebrow', '走进实验室英文小字', 'Explore'], ['home_explore_title', '走进实验室标题', '走进实验室'],
      ['home_explore_description', '走进实验室说明', '从团队、成果到活动，全面了解 AILAB 的方方面面。', 'textarea'],
      ['home_team_card_title', '团队卡片标题', '团队风采'], ['home_team_card_desc', '团队卡片说明', '认识实验室的核心团队'],
      ['home_awards_card_title', '成果卡片标题', '成果展示'], ['home_awards_card_desc', '成果卡片说明', '竞赛获奖与科研成果'],
      ['home_life_card_title', '社团生活卡片标题', '社团生活'], ['home_life_card_desc', '社团生活卡片说明', '踏青、团建与日常点滴'],
      ['home_resources_card_title', '资料卡片标题', '学习资料'], ['home_resources_card_desc', '资料卡片说明', '精选 AI 学习资源库'],
      ['home_latest_title', '最新通知标题', '最新通知'], ['home_latest_eyebrow', '最新通知英文小字', 'Latest'],
      ['home_awards_title', '成果展示标题', '成果展示'], ['home_awards_eyebrow', '成果展示英文小字', 'Honors'],
      ['home_view_all', '查看全部按钮', '查看全部'], ['home_empty_notice', '无通知提示', '暂无通知'], ['home_empty_awards', '无成果提示', '暂无成果'],
      ['home_pinned', '置顶标签', '置顶'], ['home_cta_title', '底部邀请标题', '准备好加入我们了吗？'],
      ['home_cta_description', '底部邀请说明', '无论你是初学者还是资深研究者，AILAB 都欢迎你的到来。', 'textarea'],
      ['home_cta_button', '底部邀请按钮', '查看加入方式'],
    ],
  },
  {
    id: 'members', label: '团队', fields: [
      ['members_eyebrow', '英文小字', 'Our Team'], ['members_title', '页面标题', '团队'],
      ['members_description', '页面说明', '汇聚东华大学对人工智能充满热忱的青年学者与指导老师。', 'textarea'],
      ['members_advisor', '指导老师标题', '指导老师'], ['members_current', '在校成员标题', '在校成员'], ['members_graduated', '毕业成员标题', '已毕业成员'],
      ['members_empty_current', '无在校成员提示', '暂无在校成员'], ['members_empty_graduated', '无毕业成员提示', '暂无毕业成员'],
      ['members_from', '来自标签', '来自'], ['members_hobbies', '兴趣爱好标签', '兴趣爱好'], ['members_research', '研究方向标签', '研究方向'],
      ['members_bio', '个人简介标签', '个人简介'], ['members_advisor_bio', '老师简介标签', '简介'], ['members_competition', '竞赛获奖标签', '竞赛获奖'],
      ['members_achievements', '科研成果标签', '科研成果'], ['members_message', '寄语标签', '写给学弟学妹的话'],
      ['members_destination', '毕业去向标题', '毕业去向'], ['members_destination_type', '去向标签', '去向'], ['members_organization', '单位标签', '单位'],
      ['members_specialty', '专业方向标签', '专业方向'], ['members_position', '岗位标签', '岗位'], ['members_graduated_badge', '毕业状态文字', '已毕业'],
      ['members_grade_suffix', '年级后缀', '级'], ['members_grade_unassigned', '未填写年级分组', '未填写年级'], ['members_count_unit', '成员数量单位', '人'],
    ],
  },
  {
    id: 'guide', label: 'AI 入门指南', fields: [
      ['guide_eyebrow', '顶部英文小字', 'AILAB Learning Guide'], ['guide_title', '页面主标题', 'AILAB 研究方向入门指南'],
      ['guide_subtitle', '主标题下方小字', '从基本概念和实践工具开始，逐步建立人工智能研究所需要的知识与工程能力。', 'textarea'],
      ['guide_start_button', '开始按钮', '开始学习'], ['guide_purpose_title', '目标与宗旨标题', '目标与宗旨'],
      ['guide_purpose_p1', '目标说明第一段', '本指南汇总实验室研究方向所需的基础课程、工程工具和实践资源，帮助新成员建立清晰、可执行的学习路线。', 'textarea'],
      ['guide_purpose_p2', '目标说明第二段', '学习不止于知道概念，还需要能够完成实践，并理解方法背后的原因。', 'textarea'],
      ['guide_purpose_tags', '目标标签（每行一个）', '认识概念\n掌握方法\n理解原理', 'textarea'],
      ['guide_purpose_image', '目标与宗旨图片', '', 'image'],
      ['guide_path_title', '学习路径标题', '学习路径'], ['guide_path_subtitle', '学习路径小字', 'AILAB 新成员学习与项目参与门槛'],
      ['guide_resources_title', '学习资源标题', '学习资源'], ['guide_resources_subtitle', '学习资源小字', '按研究与工程方向组织的课程、工具和实践资料'],
      ['guide_about_title', '关于标题', '关于 AILAB'],
      ['guide_about_description', '关于说明', '东华大学人工智能创新实验室关注人工智能理论、工程实践与创新应用，为成员提供课程分享、项目训练和科研交流机会。', 'textarea'],
      ['guide_about_areas', '研究方向卡片（每行一个）', '计算机视觉\n机器学习\n大语言模型\n智能体系统', 'textarea'],
      ['guide_about_image', '关于 AILAB 图片', '', 'image'],
      ['guide_next_title', '下一步标题', '继续下一步'],
      ['guide_next_description', '下一步说明', '完成基础学习后，可以了解实验室项目与招新要求，并选择适合自己的研究方向。', 'textarea'],
      ['guide_next_button', '下一步按钮', '了解如何加入'], ['guide_empty_stage', '无学习阶段提示', '暂无学习阶段'],
      ['guide_empty_category', '无资源板块提示', '暂无资源板块'], ['guide_empty_course', '无课程提示', '该板块暂未添加课程'],
      ['guide_primary_link_default', '课程主要链接默认名称', '访问资源'], ['guide_secondary_link_default', '课程第二链接默认名称', '相关资料'],
    ],
  },
  {
    id: 'notifications', label: '通知', fields: [
      ['notice_eyebrow', '通知英文小字', 'Notice'], ['notice_title', '通知标题', '通知公告'], ['notice_description', '通知说明', '实验室最新动态、新闻与活动通知。', 'textarea'], ['notice_empty', '无通知提示', '暂无通知'],
      ['notice_back', '返回列表按钮', '返回列表'], ['notice_pinned', '置顶标签', '置顶'], ['notice_category_notice', '通知分类名称', '通知'], ['notice_category_news', '新闻分类名称', '新闻'], ['notice_category_event', '活动分类名称', '活动'],
    ],
  },
  {
    id: 'awards', label: '成果', fields: [
      ['awards_eyebrow', '成果英文小字', 'Achievements'], ['awards_title', '成果标题', '成果展示'], ['awards_description', '成果说明', '实验室成员在各类竞赛与科研中取得的成果，涵盖竞赛获奖与科研成果。', 'textarea'],
      ['awards_competition', '竞赛获奖分类', '竞赛获奖'], ['awards_research', '科研成果分类', '科研成果'], ['awards_empty_competition', '无竞赛获奖提示', '暂无竞赛获奖'], ['awards_empty_research', '无科研成果提示', '暂无科研成果'],
      ['awards_level_national', '国家级标签', '国家级'], ['awards_level_provincial', '省级标签', '省级'], ['awards_level_university', '校级标签', '校级'], ['awards_level_other', '其他级别标签', '其他'],
    ],
  },
  {
    id: 'activities', label: '社团活动', fields: [
      ['activities_eyebrow', '活动英文小字', 'Activities'], ['activities_title', '活动标题', '社团活动'], ['activities_description', '活动说明', '技术沙龙、项目实践与学术交流——记录实验室的每一次相聚。', 'textarea'], ['activities_empty', '无活动提示', '暂无活动'],
      ['activities_document', '相关文档按钮', '相关文档'], ['activities_detail', '详情链接按钮', '详情链接'],
    ],
  },
  {
    id: 'club_life', label: '社团生活', fields: [
      ['life_eyebrow', '社团生活英文小字', 'Club Life'], ['life_title', '社团生活标题', '社团生活'], ['life_description', '社团生活说明', '踏青、团建、日常点滴——记录实验室成员在一起的每个瞬间。', 'textarea'], ['life_empty', '无照片提示', '暂无照片'],
      ['life_default_album', '默认相册名称', '日常活动'], ['life_photo_unit', '照片数量单位', '张'],
    ],
  },
  {
    id: 'videos', label: '视频', fields: [
      ['videos_eyebrow', '视频英文小字', 'Bilibili'], ['videos_title', '视频标题', 'B站视频'], ['videos_description', '视频说明', '实验室的技术分享、项目展示与精彩瞬间，都在 B 站。', 'textarea'], ['videos_empty', '无视频提示', '暂无视频'],
    ],
  },
  {
    id: 'resources', label: '学习资料', fields: [
      ['resources_eyebrow', '资料英文小字', 'Knowledge Vault'], ['resources_title', '资料标题', '学习资料'], ['resources_description', '资料说明', '实验室精选的 AI 学习资源，涵盖论文、代码、数据集与视频。', 'textarea'], ['resources_all', '全部分类标签', '全部'], ['resources_empty', '无资料提示', '暂无资料'], ['resources_download', '下载按钮', '下载'],
    ],
  },
  {
    id: 'qa', label: '常见问题', fields: [
      ['qa_eyebrow', '问答英文小字', 'Q & A'], ['qa_title', '问答标题', '常见问题'], ['qa_description', '问答说明', '关于实验室、加入方式与日常活动的常见疑问解答。', 'textarea'], ['qa_empty', '无问答提示', '暂无问答'],
    ],
  },
  {
    id: 'join', label: '加入我们', fields: [
      ['join_eyebrow', '顶部英文小字', 'How to join us'], ['join_title', '页面标题', '加入我们，开启 AI 之旅'],
      ['join_description', '页面说明', 'AILAB 每年设有秋季招新与暑期招新两个批次，要求与流程各有不同，请选择对应批次查看。', 'textarea'],
      ['join_autumn', '秋季招新名称', '秋季招新'], ['join_summer', '暑期招新名称', '暑期招新'],
      ['join_requirements', '要求标题后缀', '加入要求'], ['join_process', '流程标题后缀', '加入流程'],
      ['join_contact_eyebrow', '联系英文小字', 'Contact'], ['join_contact_title', '联系标题', '联系我们'],
      ['join_contact_description', '联系说明', '有任何疑问，欢迎通过以下方式与我们取得联系。', 'textarea'], ['join_no_contact', '无联系方式提示', '暂未配置联系方式'],
      ['join_email_label', '邮箱标签', '邮箱'], ['join_bilibili_label', 'B站标签', 'B站'], ['join_qq_label', 'QQ群标签', 'QQ群'],
    ],
  },
  {
    id: 'system', label: '登录与错误页面', fields: [
      ['login_eyebrow', '登录页英文小字', 'AILAB Admin'], ['login_title', '登录页标题', '管理员登录'],
      ['login_description', '登录页说明', '请输入管理员账号和密码进入内容管理后台。', 'textarea'],
      ['login_account', '账号标签', '账号'], ['login_account_placeholder', '账号输入提示', '请输入管理员账号'],
      ['login_password', '密码标签', '密码'], ['login_password_placeholder', '密码输入提示', '请输入管理员密码'],
      ['login_button', '登录按钮', '登录管理后台'], ['login_loading', '登录中提示', '正在登录…'], ['login_error', '登录失败提示', '账号或密码错误，请重新输入。'],
      ['not_found_title', '404 页面标题', '页面不存在'], ['not_found_description', '404 页面说明', '无法找到你访问的页面。'], ['not_found_button', '404 返回按钮', '返回首页'],
    ],
  },
];

export const SITE_TEXT_DEFAULTS = Object.fromEntries(
  SITE_TEXT_GROUPS.flatMap((group) => group.fields.map(([key, , value]) => [key, value]))
);

export function createTextGetter(settings) {
  const custom = settings?.page_texts && typeof settings.page_texts === 'object' ? settings.page_texts : {};
  return (key) => custom[key] ?? SITE_TEXT_DEFAULTS[key] ?? key;
}

export function useSiteText() {
  const settings = useSiteSettings();
  return useMemo(() => createTextGetter(settings), [settings]);
}

export function splitTextLines(value) {
  return String(value || '').split('\n').map((line) => line.trim()).filter(Boolean);
}
