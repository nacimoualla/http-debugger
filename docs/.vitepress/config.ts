import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'http-debugger',
  description: 'Zero-dependency HTTP debug middleware for Node.js, Deno, Bun, and the Edge',
  lang: 'en-US',
  lastUpdated: true,
  cleanUrls: true,
  metaChunk: true,
  base: '/http-debugger/',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    ['meta', { name: 'theme-color', content: '#0d1117' }]
  ],

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Guide', link: '/guides/migration/from-morgan', activeMatch: '/guides/' },
      { text: 'API Reference', link: '/api/', activeMatch: '/api/' },
      { text: 'Cookbook', link: '/guides/cookbook/ai-streaming', activeMatch: '/guides/cookbook/' },
      { text: 'Architecture', link: '/guides/architecture/adrs', activeMatch: '/guides/architecture/' },
      {
        text: 'v1.6.0',
        items: [
          { text: 'Changelog', link: 'https://github.com/nacimoualla/http-debugger/blob/main/CHANGELOG.md' },
          { text: 'Contributing', link: '/guides/architecture/contributing' }
        ]
      }
    ],

    sidebar: {
      '/guides/': [
        {
          text: 'Migration Guides',
          items: [
            { text: 'From Morgan', link: '/guides/migration/from-morgan' },
            { text: 'From Pino', link: '/guides/migration/from-pino' }
          ]
        },
        {
          text: 'Cookbook',
          items: [
            { text: 'AI Streaming', link: '/guides/cookbook/ai-streaming' },
            { text: 'GraphQL', link: '/guides/cookbook/graphql' },
            { text: 'Authentication', link: '/guides/cookbook/auth' },
            { text: 'File Uploads', link: '/guides/cookbook/file-uploads' },
            { text: 'WebSockets', link: '/guides/cookbook/websockets' }
          ]
        },
        {
          text: 'Architecture',
          items: [
            { text: 'ADRs', link: '/guides/architecture/adrs' },
            { text: 'Plugin Authoring', link: '/guides/architecture/plugin-authoring' },
            { text: 'Contributing', link: '/guides/architecture/contributing' }
          ]
        }
      ],
      '/api/': []
    },

    search: {
      provider: 'local',
      options: {
        detailedView: true
      }
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/nacimoualla/http-debugger' },
      { icon: 'npm', link: 'https://www.npmjs.com/package/http-debugger' },
      { icon: 'jsr', link: 'https://jsr.io/@nacimoualla/http-debugger' }
    ],

    editLink: {
      pattern: 'https://github.com/nacimoualla/http-debugger/edit/main/docs/:path',
      text: 'Edit this page on GitHub'
    },

    footer: {
      message: 'Released under the MIT License with No-Resale Clause.',
      copyright: 'Copyright © 2024-present Nacim Oualla'
    }
  },

  vite: {
    optimizeDeps: {
      exclude: ['@nacimoualla/http-debugger']
    },
    build: {
      rollupOptions: {
        external: ['/superpowers/']
      }
    }
  }
})