import 'server-only';
import { APIError, type CollectionBeforeOperationHook } from 'payload';

// Hold the matching native user row until the existing native reset transaction
// consumes its expiry. The no-op write uses the official adapter; hashing,
// expiry consumption, session revocation and cookie generation remain native.
export const reserveNativePasswordReset: CollectionBeforeOperationHook = async ({
  operation,
  req,
  args,
}) => {
  if (operation !== 'resetPassword') return;
  const token = (args as { data?: { token?: unknown } }).data?.token;
  if (typeof token !== 'string' || !/^[a-f0-9]{40}$/.test(token)) return;
  if (!req.transactionID) throw new APIError('Recovery requires a transaction.', 503);
  const reserved = await req.payload.db.updateOne({
    collection: 'users',
    req,
    options: { atomic: true },
    where: {
      and: [
        { resetPasswordToken: { equals: token } },
        { resetPasswordExpiration: { greater_than: new Date().toISOString() } },
      ],
    },
    data: { resetPasswordToken: token },
    select: { id: true },
  });
  if (!reserved) throw new APIError('Token is either invalid or has expired.', 403);
};
