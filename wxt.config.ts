import { defineConfig } from 'wxt'

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-vue'],
  alias: {
    '@shared': 'src/shared',
    '@popup': 'src/popup',
    '@manager': 'src/manager',
  },
  vite: () => ({
    optimizeDeps: {
      exclude: [
        '@jsquash/png',
        '@jsquash/jpeg',
        '@jsquash/webp',
        '@jsquash/oxipng',
      ],
    },
  }),
  manifest: {
    name: 'Work DevTools',
    description: '面向开发与测试场景的浏览器工具集，提供 Cookie、Bridge 注入、常用开发地址与图片压缩',
    key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAq6EWq3nqGcAXyLAWpyceQAfPe0gTu/Wr7QRQYTjyNbeBYqoaA5dReX4CwUEVmuhn1T6L2pzffeKYbG/xYSQZB8O3je+AVvvBC3AStUUESKDSgeYdJgDn6KD7Qy4FGD2rEghoA/Zxf3s0R5yEtZyPZbs3HJk56+SbXOMOFqyU3HknHVnZwankXmvKolPtLoe4h1GvxDMrhDUCcY0TiJjmei/GDZF/cdoJ2GZt0tWqbSrIxws32slh/C2LDoyzFaAe0P1cr0EixhhKb1K7lO2nG1yforqghsf+5xojhkCw1mH8nxiz78xmi4MeI/6rbsmtYdKSu7OA5G0578NbmcIuuQIDAQAB',
    permissions: [
      'cookies',
      'activeTab',
      'storage',
      'debugger',
      'scripting',
      'contextMenus',
    ],
    host_permissions: ['<all_urls>'],
    action: {
      default_title: 'Work DevTools',
    },
    web_accessible_resources: [
      {
        resources: ['assets/*.wasm'],
        matches: ['<all_urls>'],
      },
    ],
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; connect-src 'self' https://api.tinify.com https://api.tinify.cn",
    },
  },
})
