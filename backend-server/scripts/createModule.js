/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

/**
 * Usage:
 * node scripts/createModule.js user
 */

const moduleName = process.argv[2];

if (!moduleName) {
  console.error('❌ Please provide a module name.');
  process.exit(1);
}

/* --------------------------------------------------
   PATHS
-------------------------------------------------- */

const ROOT_DIR = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const MODULE_DIR = path.join(SRC_DIR, 'modules');
const ROOT_CONTAINER = path.join(SRC_DIR, 'container.ts');

const targetModuleDir = path.join(MODULE_DIR, moduleName);
const pascalName = toPascal(moduleName);

/* --------------------------------------------------
   TEMPLATES
-------------------------------------------------- */

const controllerTemplate = `
import { Request, Response, RequestHandler } from 'express'
import { injectable } from 'tsyringe'

import { BaseController } from '@/core/base_classes/base.controller'
import { ${pascalName}Service } from '@/modules/${moduleName}/${moduleName}.services'

@injectable()
export class ${pascalName}Controller extends BaseController {
  public example: RequestHandler

  constructor(
    private readonly ${moduleName}Service: ${pascalName}Service
  ) {
    super()
    this.example = this.wrap(this._example)
  }

  private async _example(
    _req: Request,
    res: Response
  ): Promise<void> {
    const result = this.${moduleName}Service.example()
    res.status(200).json({ result })
  }
}
`.trim();

const serviceTemplate = `
import { injectable } from 'tsyringe'

@injectable()
export class ${pascalName}Service {
  example(): string {
    return '${pascalName} service works'
  }
}
`.trim();

const middlewareTemplate = `
import { Request, Response, NextFunction, RequestHandler } from 'express'
import { injectable } from 'tsyringe'

import { BaseMiddleware } from '@/core/base_classes/base.middleware'

@injectable()
export class ${pascalName}Middleware extends BaseMiddleware {
  public handle: RequestHandler

  constructor() {
    super()
    this.handle = this.wrap(this._handle)
  }

  private async _handle(
    _req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> {
    next()
  }
}
`.trim();

const routesTemplate = `
import { Router } from 'express'
import { container } from 'tsyringe'

import { ${pascalName}Controller } from '@/modules/${moduleName}/${moduleName}.controllers'
import { ${pascalName}Middleware } from '@/modules/${moduleName}/${moduleName}.middlewares'

const router = Router()

const controller = container.resolve(${pascalName}Controller)
const middleware = container.resolve(${pascalName}Middleware)

router.get('/', middleware.handle, controller.example)

export default router
`.trim();

const containerTemplate = `
import { container } from 'tsyringe'

import { ${pascalName}Controller } from '@/modules/${moduleName}/${moduleName}.controllers'
import { ${pascalName}Middleware } from '@/modules/${moduleName}/${moduleName}.middlewares'
import { ${pascalName}Service } from '@/modules/${moduleName}/${moduleName}.services'

export const register${pascalName}Module = (): void => {
  container.registerSingleton(${pascalName}Service)
  container.registerSingleton(${pascalName}Controller)
  container.registerSingleton(${pascalName}Middleware)
}
`.trim();

const dtoTemplate = `
import { BaseDTO } from '@/core/base_classes/dto.base'
`.trim();

const schemaTemplate = `
import { z } from 'zod'

export const Create${pascalName}Schema = z.object({})
`.trim();

/* --------------------------------------------------
   FILE MAP
-------------------------------------------------- */

const files = {
  [`${moduleName}.controllers.ts`]: controllerTemplate,
  [`${moduleName}.services.ts`]: serviceTemplate,
  [`${moduleName}.middlewares.ts`]: middlewareTemplate,
  [`${moduleName}.routes.ts`]: routesTemplate,
  [`${moduleName}.schemas.ts`]: schemaTemplate,
  [`${moduleName}.model.ts`]: `import { Schema, model } from 'mongoose'\n`,
  [`${moduleName}.dto.ts`]: dtoTemplate,
  [`${moduleName}.types.ts`]: '',
  [`${moduleName}.container.ts`]: containerTemplate,
};

/* --------------------------------------------------
   CREATE MODULE FOLDER
-------------------------------------------------- */

if (!fs.existsSync(MODULE_DIR)) {
  fs.mkdirSync(MODULE_DIR, { recursive: true });
}

if (!fs.existsSync(targetModuleDir)) {
  fs.mkdirSync(targetModuleDir);
  console.log(`📁 Created module: ${moduleName}`);
} else {
  console.log(`⚠️ Module already exists: ${moduleName}`);
}

/* --------------------------------------------------
   CREATE FILES
-------------------------------------------------- */

Object.entries(files).forEach(([file, content]) => {
  const filePath = path.join(targetModuleDir, file);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content);
    console.log(`📄 Created ${file}`);
  }
});

/* --------------------------------------------------
   UPDATE ROOT CONTAINER
-------------------------------------------------- */

updateRootContainer();

console.log(`✅ Module '${moduleName}' setup complete.`);

/* --------------------------------------------------
   HELPERS
-------------------------------------------------- */

function toPascal(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function updateRootContainer() {
  if (!fs.existsSync(ROOT_CONTAINER)) {
    fs.writeFileSync(
      ROOT_CONTAINER,
      `
import 'reflect-metadata'

// AUTO-IMPORTS (DO NOT REMOVE)

export const registerContainers = (): void => {
  // AUTO-REGISTER (DO NOT REMOVE)
}

export default registerContainers
`.trim()
    );
  }

  let content = fs.readFileSync(ROOT_CONTAINER, 'utf8');

  const importLine = `import { register${pascalName}Module } from '@/modules/${moduleName}/${moduleName}.container'`;
  const registerLine = `  register${pascalName}Module()`;

  if (!content.includes(importLine)) {
    content = content.replace(
      '// AUTO-IMPORTS (DO NOT REMOVE)',
      `// AUTO-IMPORTS (DO NOT REMOVE)\n${importLine}`
    );
  }

  if (!content.includes(registerLine)) {
    content = content.replace(
      '// AUTO-REGISTER (DO NOT REMOVE)',
      `// AUTO-REGISTER (DO NOT REMOVE)\n${registerLine}`
    );
  }

  fs.writeFileSync(ROOT_CONTAINER, content);
}
