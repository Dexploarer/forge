import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import multipart from '@fastify/multipart'

const multipartPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024,
      files: 1,
    },
  })

  fastify.log.info('✅ Multipart plugin registered')
}

export default fp(multipartPlugin, {
  name: 'multipart-plugin'
})
