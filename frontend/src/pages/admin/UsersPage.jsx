import { useAppContext } from "../../context/AppContext";
import { formatDateTime } from "../../lib/format";

export function UsersPage() {
  const { users, currentUserId, setCurrentUserId, currentUser } = useAppContext();

  return (
    <div className="admin-content">
      <section className="dashboard-hero">
        <div>
          <span className="hero-pill">Users</span>
          <h2>用户与角色</h2>
          <p>模拟企业内部多角色使用场景，便于演示管理员与普通成员的权限差异。</p>
        </div>
      </section>

      <section className="admin-grid two-columns">
        <article className="panel-card">
          <div className="panel-head">
            <div>
              <span className="panel-kicker">Current User</span>
              <h3>当前身份</h3>
            </div>
          </div>

          <div className="user-profile">
            <div className="user-avatar large">
              {(currentUser?.name || "A").slice(0, 1).toUpperCase()}
            </div>
            <div>
              <strong>{currentUser?.name || "admin"}</strong>
              <p>{currentUser?.role || "admin"}</p>
            </div>
          </div>

          <label className="toolbar-field">
            <span>切换为</span>
            <select value={currentUserId} onChange={(event) => setCurrentUserId(event.target.value)}>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.role})
                </option>
              ))}
            </select>
          </label>
        </article>

        <article className="panel-card">
          <div className="panel-head">
            <div>
              <span className="panel-kicker">Permission Model</span>
              <h3>权限说明</h3>
            </div>
          </div>
          <div className="permission-list">
            <div>
              <strong>admin</strong>
              <p>可上传/删除知识文档、切换模型、执行评估。</p>
            </div>
            <div>
              <strong>member</strong>
              <p>可查看知识库和使用聊天能力，但不能变更系统配置。</p>
            </div>
          </div>
        </article>
      </section>

      <section className="panel-card">
        <div className="panel-head">
          <div>
            <span className="panel-kicker">User Directory</span>
            <h3>用户列表</h3>
          </div>
        </div>

        <div className="user-grid">
          {users.map((user) => (
            <article key={user.id} className="user-list-card">
              <div className="user-row">
                <div className="user-avatar">
                  {user.name.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <strong>{user.name}</strong>
                  <p>{user.role_label || user.role}</p>
                </div>
              </div>
              <div className="definition-list compact">
                <div>
                  <span>创建时间</span>
                  <strong>{formatDateTime(user.created_at)}</strong>
                </div>
                <div>
                  <span>知识库权限</span>
                  <strong>{user.can_manage_knowledge ? "可管理" : "只读"}</strong>
                </div>
                <div>
                  <span>模型权限</span>
                  <strong>{user.can_manage_models ? "可管理" : "只读"}</strong>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
