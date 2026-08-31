export interface RouteConfig {
  id: string;
  name: string;
  path: string;
  title: string;
  iconName: string;
}

export const ROUTES: Record<string, RouteConfig> = {
  CHAT: {
    id: 'ai-chat',
    name: 'AIChat',
    path: '/ai-chat',
    title: 'AI General Chat',
    iconName: 'chatbubble-ellipses-outline',
  },
  CODE: {
    id: 'ai-code',
    name: 'AICode',
    path: '/ai-code',
    title: 'AI Code Studio',
    iconName: 'code-slash-outline',
  },
  VISION: {
    id: 'ai-vision',
    name: 'AIVision',
    path: '/ai-vision',
    title: 'AI Vision & Design',
    iconName: 'eye-outline',
  },
};
