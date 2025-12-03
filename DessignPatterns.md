### **1. Patrón de Módulo (Module Pattern)**

- **¿Qué es?** Es la forma más básica y fundamental de organizar el código. En TypeScript/Node.js, cada archivo es un módulo. Este patrón consiste en agrupar la lógica relacionada en su propio archivo y exportar solo lo que otros archivos necesitan usar.

- **¿Por qué lo necesitamos?** Para no tener un único archivo `index.ts` con miles de líneas. Nos permite separar cada `tool` en su propio archivo, haciendo el código más limpio, fácil de encontrar y de mantener. Ya lo mencionamos al definir la estructura de carpetas (`src/tools`, `src/services`), y este es el patrón que lo formaliza.

- **Ejemplo Práctico:**

  ```typescript
  // src/tools/instagram/getLatestPosts.ts

  import { PrismaClient } from '@prisma/client';
  import { z } from 'zod';

  // Lógica encapsulada en este módulo
  async function getLatestPostsLogic(prisma: PrismaClient, username: string) {
    // ...código para buscar el usuario y sus posts en la BD
    return prisma.instagram_post.findMany({
      where: { user: { username } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }

  // Exportamos solo lo necesario para registrar la tool
  export const getLatestPostsTool = {
    name: 'getLatestInstagramPosts',
    schema: { username: z.string() },
    logic: getLatestPostsLogic,
  };

  // src/core/server.ts
  import { getLatestPostsTool } from '../tools/instagram/getLatestPosts';
  // ...
  // server.registerTool(...)
  ```

---

### **2. Patrón de Capa de Servicio (Service Layer)**

- **¿Qué es?** Es una capa de abstracción que se sitúa entre la capa de presentación (nuestras `tools`) y la capa de acceso a datos (Prisma Client). Contiene la lógica de negocio pura.

- **¿Por qué lo necesitamos?** Para que las `tools` no se llenen de lógica de negocio compleja. La `tool` solo debe encargarse de recibir la petición, validar los datos y llamar a un "servicio". Esto hace que la lógica de negocio sea **reutilizable** (quizás dos `tools` diferentes necesiten calcular el engagement de un post) y más fácil de **probar unitariamente**.

- **Ejemplo Práctico:**

  ```typescript
  // src/services/instagramEngagementService.ts

  import { PrismaClient, instagram_post } from '@prisma/client';

  export class InstagramEngagementService {
    constructor(private prisma: PrismaClient) {}

    async calculateEngagement(postId: number): Promise<number> {
      const post = await this.prisma.instagram_post.findUnique({
        where: { id: postId },
        include: { user: true },
      });

      if (!post || !post.user.followers) {
        return 0;
      }

      const engagement = (post.likes + post.comments) / post.user.followers;
      return engagement * 100; // Devuelve el porcentaje
    }
  }

  // src/tools/instagram/getPostEngagement.ts
  // ...
  const engagementService = new InstagramEngagementService(prisma);
  // Dentro de la lógica de la tool:
  const engagement = await engagementService.calculateEngagement(input.postId);
  // ...
  ```

---

### **3. Inyección de Dependencias (Dependency Injection - DI)**

- **¿Qué es?** En lugar de que un componente cree sus propias dependencias (como `new PrismaClient()` dentro de una clase), estas se le "inyectan" desde fuera (normalmente en el constructor).

- **¿Por qué lo necesitamos?** Es clave para la **testabilidad** y el **desacoplamiento**. En el ejemplo anterior, `InstagramEngagementService` recibe la instancia de `prisma` en su constructor. Cuando hagamos pruebas, en lugar de pasarle una conexión real a la base de datos, podemos pasarle un "mock" (una imitación) de Prisma. Esto hace las pruebas más rápidas y fiables.

- **Ejemplo Práctico:**

  ```typescript
  // En el código de producción
  // src/core/server.ts
  import { PrismaClient } from '@prisma/client';
  import { InstagramEngagementService } from '../services/instagramEngagementService';

  const prisma = new PrismaClient(); // Se crea una sola vez
  const engagementService = new InstagramEngagementService(prisma); // Se inyecta

  // En el código de prueba (con Jest, por ejemplo)
  // src/services/instagramEngagementService.test.ts
  import { mockDeep } from 'jest-mock-extended';
  import { PrismaClient } from '@prisma/client';

  const mockPrisma = mockDeep<PrismaClient>(); // Creamos un mock de Prisma
  const engagementService = new InstagramEngagementService(mockPrisma); // Inyectamos el mock

  test('should calculate engagement correctly', async () => {
    // Configuramos el mock para que devuelva datos falsos
    mockPrisma.instagram_post.findUnique.mockResolvedValueOnce({
      id: 1,
      likes: 100,
      comments: 50,
      user: { followers: 1500 },
      // ...otros campos
    });

    const engagement = await engagementService.calculateEngagement(1);
    expect(engagement).toBe(10); // (100 + 50) / 1500 * 100 = 10
  });
  ```

---

### **4. Patrón Estrategia (Strategy Pattern)**

- **¿Qué es?** Permite definir una familia de algoritmos, encapsular cada uno de ellos y hacerlos intercambiables. Permite que el algoritmo varíe independientemente de los clientes que lo utilizan.

- **¿Por qué lo necesitamos?** ¡Potencialmente muy útil para ustedes\! Tienen entidades para Instagram, Facebook, TikTok. Imaginen que quieren una `tool` llamada `analyzePost`. La forma de analizar un post de TikTok (basado en `views`, `shares`) es diferente a la de Instagram (basado en `likes`, `comments`). Con el patrón Estrategia, pueden tener diferentes "estrategias de análisis" que se seleccionan en tiempo de ejecución según el tipo de post.

- **Ejemplo Práctico:**

  ```typescript
  // src/services/analysisStrategies.ts
  interface AnalysisStrategy {
    analyze(post: any): Promise<{ metric: string; value: number }>;
  }

  export class InstagramStrategy implements AnalysisStrategy {
    async analyze(post: instagram_post) {
      // ...lógica específica de Instagram
      return { metric: 'Engagement Rate', value: (post.likes + post.comments) / 1000 };
    }
  }

  export class TiktokStrategy implements AnalysisStrategy {
    async analyze(post: tiktok_post) {
      // ...lógica específica de TikTok
      return { metric: 'View/Like Ratio', value: post.views / post.likes };
    }
  }

  // src/services/postAnalysisService.ts
  export class PostAnalysisService {
    private strategy: AnalysisStrategy;

    setStrategy(strategy: AnalysisStrategy) {
      this.strategy = strategy;
    }

    async executeAnalysis(post: any) {
      return this.strategy.analyze(post);
    }
  }
  ```

### **Resumen y Consejo para el Equipo**

No necesitan implementar todos estos patrones desde el día uno. Un buen enfoque sería:

1.  **Empezar siempre con el Patrón de Módulo.** Es la base de la organización.
2.  **Introducir la Capa de Servicio** tan pronto como una `tool` empiece a tener más de 10-15 líneas de lógica.
3.  **Adoptar la Inyección de Dependencias** desde el principio en sus servicios. Les ahorrará muchos dolores de cabeza cuando empiecen a escribir pruebas.
4.  **Mantener el Patrón Estrategia en mente** para cuando encuentren funcionalidades que varían según la plataforma (Facebook, Instagram, etc.).
