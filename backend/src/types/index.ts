import { FastifyRequest } from 'fastify'
import { users } from '../database/schema'

export type AuthenticatedRequest = FastifyRequest & {
  user: typeof users.$inferSelect
}

export type OptionalAuthRequest = FastifyRequest & {
  user?: typeof users.$inferSelect
}
