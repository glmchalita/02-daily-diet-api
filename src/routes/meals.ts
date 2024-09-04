import { FastifyInstance } from 'fastify'
import { knex } from '../database'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { checkSessionIdExists } from '../middlewares/check-session-id-exist'

export async function mealsRoutes(app: FastifyInstance) {
  app.post('/', { preHandler: [checkSessionIdExists] }, async (request, reply) => {
    const createMealBodySchema = z.object({
      name: z.string(),
      description: z.string(),
      isOnDiet: z.boolean(),
      date: z.coerce.date(),
    })

    const { name, description, isOnDiet, date } = createMealBodySchema.parse(request.body)

    await knex('meals').insert({
      id: randomUUID(),
      user_id: request.user?.id,
      name,
      description,
      is_on_diet: isOnDiet,
      date: date.getTime(),
    })

    return reply.status(201).send()
  })

  app.put('/:id', { preHandler: [checkSessionIdExists] }, async (request, reply) => {
    const paramsSchema = z.object({
      id: z.string().uuid(),
    })

    const { id } = paramsSchema.parse(request.params)

    const meal = await knex('meals').where({ id }).first()

    if (!meal) {
      return reply.status(404).send({ message: 'Meal not found' })
    }

    const editMealBodySchema = z.object({
      name: z.string().optional(),
      description: z.string().optional(),
      isOnDiet: z.boolean().optional(),
      date: z.coerce.date().optional(),
    })

    const { name, description, isOnDiet, date } = editMealBodySchema.parse(request.body)

    await knex('meals')
      .where({ id })
      .update({
        name: name ?? meal.name,
        description: description ?? meal.description,
        is_on_diet: isOnDiet ?? meal.is_on_diet,
        date: date?.getDate() ?? meal.date,
      })

    return reply.status(201).send()
  })

  app.get('/', { preHandler: [checkSessionIdExists] }, async (request) => {
    const meals = await knex('meals').where({ user_id: request.user?.id }).orderBy('date', 'desc')

    return { meals }
  })

  app.get('/:id', { preHandler: [checkSessionIdExists] }, async (request, reply) => {
    const paramsSchema = z.object({ id: z.string().uuid() })

    const { id } = paramsSchema.parse(request.params)

    const meal = await knex('meals').where({ id }).first()

    if (!meal) {
      return reply.status(404).send({ error: 'Meal not found' })
    }

    return { meal }
  })

  app.delete('/:id', { preHandler: [checkSessionIdExists] }, async (request, reply) => {
    const paramsSchema = z.object({ id: z.string().uuid() })

    const { id } = paramsSchema.parse(request.params)

    const meal = await knex('meals').where({ id }).first()

    if (!meal) {
      return reply.status(404).send({ error: 'Meal not found' })
    }

    await knex('meals').where({ id }).delete()

    return reply.status(204).send()
  })

  app.get('/metrics', { preHandler: [checkSessionIdExists] }, async (request, reply) => {
    const totalMeals = await knex('meals')
      .where({ user_id: request.user?.id })
      .orderBy('date', 'desc')

    const totalMealsOnDiet = await knex('meals')
      .where({
        user_id: request.user?.id,
        is_on_diet: true,
      })
      .count('id', { as: 'total' })
      .first()

    const totalMealsOffDiet = await knex('meals')
      .where({
        user_id: request.user?.id,
        is_on_diet: false,
      })
      .count('id', { as: 'total' })
      .first()

    const { bestOnDietSequence } = totalMeals.reduce(
      (acc, meal) => {
        if (meal.is_on_diet) {
          acc.currentSequence += 1
        } else {
          acc.currentSequence = 0
        }

        if (acc.currentSequence > acc.bestOnDietSequence) {
          acc.bestOnDietSequence = acc.currentSequence
        }

        return acc
      },
      { bestOnDietSequence: 0, currentSequence: 0 },
    )

    return reply.send({
      totalMeals: totalMeals.length,
      totalMealsOnDiet: totalMealsOnDiet?.total,
      totalMealsOffDiet: totalMealsOffDiet?.total,
      bestOnDietSequence,
    })
  })
}
