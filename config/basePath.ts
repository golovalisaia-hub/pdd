const path = process.env.VITE_BASE_PATH?.trim().replace(/^\/+|\/+$/g, '')

export const basePath = path ? `/${path}/` : '/'
