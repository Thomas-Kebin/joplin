import { ErrorBadRequest, ErrorForbidden } from './errors';
import { AppContext } from './types';

const formidable = require('formidable');

export type BodyFields = Record<string, any>;

interface FormParseResult {
	fields: BodyFields;
	files: any;
}

// Input should be Koa ctx.req, which corresponds to the native Node request
export async function formParse(req: any): Promise<FormParseResult> {
	return new Promise((resolve: Function, reject: Function) => {
		const form = formidable({ multiples: true });
		form.parse(req, (error: any, fields: any, files: any) => {
			if (error) {
				reject(error);
				return;
			}

			resolve({ fields, files });
		});
	});
}

export async function bodyFields(req: any): Promise<BodyFields> {
	if (req.headers['content-type'] !== 'application/json') {
		throw new ErrorBadRequest(`Unsupported Content-Type: "${req.headers['content-type']}". Expected: "application/json"`);
	}

	const form = await formParse(req);
	return form.fields;
}

export function headerSessionId(headers: any): string {
	return headers['x-api-auth'] ? headers['x-api-auth'] : '';
}

export function contextSessionId(ctx: AppContext): string {
	const id = ctx.cookies.get('sessionId');
	if (!id) throw new ErrorForbidden('Invalid or missing session');
	return id;
}

export function isApiRequest(ctx: AppContext): boolean {
	return ctx.path.indexOf('/api/') === 0;
}
