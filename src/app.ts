import fastify from 'fastify'
import fastifyCookie from '@fastify/cookie'
import { usersRoutes } from './routes/users'
import { mealsRoutes } from './routes/meals'

export const app = fastify()

app.register(fastifyCookie)

app.register(usersRoutes, { prefix: 'users' })

app.register(mealsRoutes, { prefix: 'meals' })
