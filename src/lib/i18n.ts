import type { UiLocale } from "@/lib/locale";

export type UiCopy = {
  nav: {
    dashboard: string;
    articles: string;
    maps: string;
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
      articles: "Articles",
      maps: "Maps",
      timeline: "Timeline",
      reviews: "Reviews",
      settings: "Settings",
      signOut: "Sign out"
    },
    workspace: {
      none: "No Workspace",
      selected: "Selected",
      role: "Role",
      open: "Open workspace",
      quickLinks: "Quick links"
    },
    dashboard: {
      workspaces: "Workspaces",
      notifications: "Notifications",
      create: "Create workspace",
      createAction: "Create",
      join: "Join workspace",
      joinAction: "Join",
      name: "Name",
      slug: "Slug",
      workspaceSlug: "Workspace slug",
      none: "No workspaces yet.",
      noUnread: "No unread notifications.",
      markRead: "Mark read"
    },
    locale: {
      label: "Language",
      english: "English",
      japanese: "Japanese"
    },
    filters: {
      worldEra: "World Era",
      storyChapter: "Story Chapter",
      viewpoint: "Viewpoint",
      mode: "Mode",
      modeCanon: "Canon",
      modeViewpoint: "As Viewpoint",
      modeCompare: "Compare",
      allEras: "All Eras",
      allChapters: "All Chapters",
      omni: "Omni (Canon)"
    }
  },
  ja: {
    nav: {
      dashboard: "ダッシュボード",
      articles: "記事",
      maps: "地図",
      timeline: "年表",
      reviews: "レビュー",
      settings: "設定",
      signOut: "サインアウト"
    },
    workspace: {
      none: "ワークスペースなし",
      selected: "選択中",
      role: "権限",
      open: "ワークスペースを開く",
      quickLinks: "主要リンク"
    },
    dashboard: {
      workspaces: "ワークスペース",
      notifications: "通知",
      create: "ワークスペース作成",
      createAction: "作成",
      join: "ワークスペース参加",
      joinAction: "参加",
      name: "名称",
      slug: "スラッグ",
      workspaceSlug: "ワークスペーススラッグ",
      none: "参加中のワークスペースがありません。",
      noUnread: "未読の通知はありません。",
      markRead: "既読にする"
    },
    locale: {
      label: "言語",
      english: "英語",
      japanese: "日本語"
    },
    filters: {
      worldEra: "時代",
      storyChapter: "章",
      viewpoint: "視点",
      mode: "モード",
      modeCanon: "正史",
      modeViewpoint: "視点",
      modeCompare: "比較",
      allEras: "全時代",
      allChapters: "全章",
      omni: "全知（正史）"
    }
  }
};

export function getUiCopy(locale: UiLocale): UiCopy {
  return UI_COPY[locale] ?? UI_COPY.en;
}
