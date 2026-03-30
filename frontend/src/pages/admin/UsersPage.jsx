import { useAppContext } from "../../context/AppContext";

export function UsersPage() {
  const { currentUserId, users } = useAppContext();

  return (
    <div className="admin-page-grid">
      <section className="content-card wide">
        <div className="card-head">
          <div>
            <span className="eyebrow">Users</span>
            <h3>Identities and permissions</h3>
          </div>
        </div>

        <div className="user-grid">
          {users.map((user) => (
            <article
              key={user.id}
              className={user.id === currentUserId ? "user-card active" : "user-card"}
            >
              <div className="user-card-head">
                <div className="profile-avatar">{user.name.slice(0, 1).toUpperCase()}</div>
                <div>
                  <strong>{user.name}</strong>
                  <p>{user.role === "admin" ? "Administrator" : "Member"}</p>
                </div>
              </div>
              <div className="tag-row">
                {(user.permissions || []).map((permission) => (
                  <span key={permission} className="tag-chip">
                    {permission}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
