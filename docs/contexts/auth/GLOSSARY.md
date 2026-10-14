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

**User deletion**:
A User's request to leave CueMemory. It ends all of their Sessions, can be undone by a User restore during the Grace period, and becomes permanent after it. "Delete my account" may still appear as UI copy.
_Avoid_: Account deletion, deactivation, closing an account

**User restore**:
A deleted User signing in again within the Grace period, which undoes the User deletion and brings back everything they saved.
_Avoid_: Reactivation, account recovery, undelete

**Grace period**:
The 30 days after User deletion during which the deleted User can still be restored by signing in again.
_Avoid_: Cooling-off period, retention window

**Session**:
One signed-in browser. A User can have several Sessions at once, and User deletion ends all of them.
_Avoid_: Login, connection
