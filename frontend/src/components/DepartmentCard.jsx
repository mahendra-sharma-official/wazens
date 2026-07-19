import { Link } from "react-router-dom";
import { shortAddress } from "../lib/format.js";

export function DepartmentCard({ department }) {
  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Department {String(department.id)}</p>

          <h3>{department.name}</h3>

          <p className="hint">
            Head:{" "}
            <Link to={`/officials/${department.head}`}>
              {department.headName || shortAddress(department.head)}
            </Link>
          </p>

          <p className="hint">
            Officials:{" "}
            <Link
              to={`/officials?department=${department.id}&name=${encodeURIComponent(
                department.name
              )}`}
            >
              View department officials
            </Link>
          </p>
        </div>
      </div>
    </article>
  );
}