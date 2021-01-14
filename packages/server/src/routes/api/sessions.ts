import { SubPath } from '../../utils/routeUtils';
import Router from '../../utils/Router';
import { ErrorForbidden } from '../../utils/errors';
import { AppContext } from '../../utils/types';
import { bodyFields } from '../../utils/requestUtils';
import { User } from '../../db';

const router = new Router();

router.public = true;

router.post('api/sessions', async (_path: SubPath, ctx: AppContext) => {
	const fields: User =  await bodyFields(ctx.req);
	const user = await ctx.models.user().login(fields.email, fields.password);
	if (!user) throw new ErrorForbidden('Invalid username or password');

	const session = await ctx.models.session().createUserSession(user.id);
	return { id: session.id };
});

export default router;
