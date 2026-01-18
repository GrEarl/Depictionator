import type { UiLocale } from "@/lib/locale";

export type UiCopy = {
  nav: {
    dashboard: string;
    ai: string;
    articles: string;
    maps: string;
    boards: string;
    timeline: string;
    reviews: string;
    settings: string;
    signOut: string;
  };
  workspace: {
    none: string;
    selected: string;
    role: string;
    open: string;
    quickLinks: string;
  };
  dashboard: {
    workspaces: string;
    notifications: string;
    create: string;
    createAction: string;
    join: string;
    joinAction: string;
    name: string;
    slug: string;
    workspaceSlug: string;
    none: string;
    noUnread: string;
    markRead: string;
    overview: string;
    beginLegend: string;
    canvasAwaits: string;
    createFirstEntity: string;
    openAtlas: string;
    openBoards: string;
    recentActivity: string;
    quickActions: string;
  };
  locale: {
    label: string;
    english: string;
    japanese: string;
  };
  filters: {
    worldEra: string;
    storyChapter: string;
    viewpoint: string;
    mode: string;
    modeCanon: string;
    modeViewpoint: string;
    modeCompare: string;
    allEras: string;
    allChapters: string;
    omni: string;
  };
};

export const UI_COPY: Record<UiLocale, UiCopy> = {
  en: {
    nav: {
      dashboard: "Dashboard",
      ai: "AI Assistant",
      articles: "Entities",
      maps: "Atlas",
      boards: "Boards",
      timeline: "Chronicle",
      reviews: "Approvals",
      settings: "Settings",
      signOut: "Log out"
    },
    workspace: {
      none: "No Workspace Selected",
      selected: "Active Project",
      role: "Your Role",
      open: "Enter Workspace",
      quickLinks: "Quick Access"
    },
    dashboard: {
      workspaces: "Projects",
      notifications: "Recent Updates",
      create: "Start a New Project",
      createAction: "Create",
      join: "Join a Project",
      joinAction: "Join",
      name: "Project Name",
      slug: "Unique ID (Slug)",
      workspaceSlug: "Project slug",
      none: "You haven't joined any projects yet.",
      noUnread: "No new activity.",
      markRead: "Mark as read",
      overview: "Overview",
      beginLegend: "Begin Your Legend",
      canvasAwaits: "Every epic world starts with a single character, a single location.\nThe canvas awaits your vision.",
      createFirstEntity: "Create First Entity",
      openAtlas: "Open Atlas",
      openBoards: "Open Boards",
      recentActivity: "Recent Activity",
      quickActions: "Quick Actions"
    },
    locale: {
      label: "Language",
      english: "English",
      japanese: "Japanese"
    },
    filters: {
      worldEra: "Historical Era",
      storyChapter: "Narrative Chapter",
      viewpoint: "Active Perspective",
      mode: "Viewing Mode",
      modeCanon: "Canon (Ground Truth)",
      modeViewpoint: "Perception",
      modeCompare: "Cross-reference",
      allEras: "All Eras",
      allChapters: "Entire Story",
      omni: "Universal View (Canon)"
    }
  },
  ja: {
    nav: {
      dashboard: "ダッシュボード",
      ai: "AIアシスタント",
      articles: "設定項目",
      maps: "地図・アトラス",
      boards: "ボード",
      timeline: "年代記",
      reviews: "承認待ち",
      settings: "システム設定",
      signOut: "ログアウト"
    },
    workspace: {
      none: "ワークスペース未選択",
      selected: "現在のプロジェクト",
      role: "ユーザー権限",
      open: "プロジェクトに入る",
      quickLinks: "クイックアクセス"
    },
    dashboard: {
      workspaces: "プロジェクト一覧",
      notifications: "最新のアクティビティ",
      create: "新規プロジェクト作成",
      createAction: "作成",
      join: "プロジェクトに参加",
      joinAction: "参加",
      name: "プロジェクト名称",
      slug: "固有ID (スラッグ)",
      workspaceSlug: "プロジェクトIDを入力",
      none: "参加中のプロジェクトはありません。",
      noUnread: "新しい通知はありません。",
      markRead: "既読にする",
      overview: "概況",
      beginLegend: "伝説を始めよう",
      canvasAwaits: "壮大な世界も、ひとりのキャラクター、ひとつの場所から始まります。\nキャンバスはあなたの構想を待っています。",
      createFirstEntity: "最初の項目を作成",
      openAtlas: "地図を開く",
      openBoards: "ボードを開く",
      recentActivity: "最近の活動",
      quickActions: "クイックアクション"
    },
    locale: {
      label: "表示言語",
      english: "English",
      japanese: "日本語"
    },
    filters: {
      worldEra: "世界史の時代",
      storyChapter: "物語の章",
      viewpoint: "アクティブな視点",
      mode: "表示モード",
      modeCanon: "正史 (マスターデータ)",
      modeViewpoint: "特定の視点情報",
      modeCompare: "情報の比較照合",
      allEras: "全ての時代",
      allChapters: "物語の全期間",
      omni: "全知視点（正史）"
    }
  }
};

export function getUiCopy(locale: UiLocale): UiCopy {
  return UI_COPY[locale] ?? UI_COPY.en;
}
