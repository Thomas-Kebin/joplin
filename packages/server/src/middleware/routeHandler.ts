import { routeResponseFormat, Response, RouteResponseFormat, execRequest } from '../utils/routeUtils';
import { AppContext, Env } from '../utils/types';
import { isView, View } from '../services/MustacheService';
import config from '../config';

export default async function(ctx: AppContext) {
	const requestStartTime = Date.now();

	try {
		const responseObject = await execRequest(ctx.joplin.routes, ctx);

		if (responseObject instanceof Response) {
			ctx.response = responseObject.response;
		} else if (isView(responseObject)) {
			const view = responseObject as View;
			ctx.response.status = view?.content?.error ? view?.content?.error?.httpCode || 500 : 200;
			ctx.response.body = await ctx.joplin.services.mustache.renderView(view, {
				notifications: ctx.joplin.notifications || [],
				hasNotifications: !!ctx.joplin.notifications && !!ctx.joplin.notifications.length,
				owner: ctx.joplin.owner,
				supportEmail: config().supportEmail,
			});
		} else {
			ctx.response.status = 200;
			ctx.response.body = [undefined, null].includes(responseObject) ? '' : responseObject;
		}
	} catch (error) {
		if (error.httpCode >= 400 && error.httpCode < 500) {
			ctx.joplin.appLogger().error(`${error.httpCode}: ` + `${ctx.request.method} ${ctx.path}` + ` : ${error.message}`);
		} else {
			ctx.joplin.appLogger().error(error);
		}

		// Uncomment this when getting HTML blobs as errors while running tests.
		// console.error(error);

		ctx.response.status = error.httpCode ? error.httpCode : 500;

		const responseFormat = routeResponseFormat(ctx);

		if (error.code === 'invalidOrigin') {
			ctx.response.body = error.message;
		} else if (responseFormat === RouteResponseFormat.Html) {
			ctx.response.set('Content-Type', 'text/html');
			const view: View = {
				name: 'error',
				path: 'index/error',
				content: {
					error,
					stack: config().showErrorStackTraces ? error.stack : '',
					owner: ctx.joplin.owner,
				},
				title: 'Error',
			};
			ctx.response.body = await ctx.joplin.services.mustache.renderView(view);
		} else { // JSON
			ctx.response.set('Content-Type', 'application/json');
			const r: any = { error: error.message };
			if (ctx.joplin.env === Env.Dev && error.stack) r.stack = error.stack;
			if (error.code) r.code = error.code;
			ctx.response.body = r;
		}
	} finally {
		// Technically this is not the total request duration because there are
		// other middlewares but that should give a good approximation
		const requestDuration = Date.now() - requestStartTime;
		ctx.joplin.appLogger().info(`${ctx.request.method} ${ctx.path} (${requestDuration}ms)`);
	}
}
