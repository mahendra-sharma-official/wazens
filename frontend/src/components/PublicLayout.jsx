import { Outlet } from "react-router-dom";
import { Shell } from "./Shell.jsx";

export function PublicLayout() {
  return (
    <Shell>
      <Outlet />
    </Shell>
  );
}
