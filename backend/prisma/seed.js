import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const count = await prisma.product.count()
  if (count > 0) return

  await prisma.product.createMany({
    data: [
      {
        name: 'Colar Pérola',
        description: 'Colar delicado com pérolas.',
        price: '19.90',
        category: 'colares',
        material: 'perolas',
        images: [],
        colors: ['branco'],
        stock: 10,
        isFeatured: true,
        status: 'active',
      },
      {
        name: 'Brinco Aço Inox',
        description: 'Brinco resistente em aço inox.',
        price: '9.90',
        category: 'brincos',
        material: 'aco_inox',
        images: [],
        colors: ['prata'],
        stock: 25,
        isNew: true,
        status: 'active',
      },
    ],
  })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })

