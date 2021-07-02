import { SubPath, redirect } from '../../utils/routeUtils';
import Router from '../../utils/Router';
import { RouteType } from '../../utils/types';
import { AppContext } from '../../utils/types';
import config from '../../config';
import { contextSessionId } from '../../utils/requestUtils';

const router = new Router(RouteType.Web);

router.post('logout', async (_path: SubPath, ctx: AppContext) => {
	const sessionId = contextSessionId(ctx, false);
	ctx.cookies.set('sessionId', '');
	await ctx.joplin.models.session().logout(sessionId);
	return redirect(ctx, `${config().baseUrl}/login`);
});

export default router;
