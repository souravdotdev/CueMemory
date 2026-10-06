# Auth

Identity for CueMemory: who a User is, how they sign in, and what happens when they leave.

## Language

**User**:
A person who has signed in to CueMemory and owns everything they save.
_Avoid_: Account, member, customer

**Sign-in identity**:
A way a User proves who they are when signing in, such as their Google identity. One User can have several; each one belongs to exactly one User.
_Avoid_: Account, login, credential

**Display name**:
The human-readable name shown for a User, taken from their sign-in provider. Not unique.
_Avoid_: Username, handle

**Account deletion**:
A User's request to leave CueMemory. It can be undone during the grace period and becomes permanent after it.
_Avoid_: Deactivation, closing an account

**Grace period**:
The 30 days after account deletion during which a User can restore their account by signing in again.
_Avoid_: Cooling-off period, retention window
