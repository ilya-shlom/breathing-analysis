import React from "react";
import { Routes, Route, Link } from "react-router-dom";

import Home from "./Home";
import About from "./About";
import Instructions from "./Instructions";


export default function Navbar() {

    return (
        <header className="bg-[var(--header-blue)] shadow-md h-15 px-10
         text-white text-xl
         flex flex-row justify-between items-center">
          <h1>breathing-analysis</h1>
          <nav className="flex flex-row gap-10 underline text-lg">
            <Link to="/">Главная</Link>
            <Link to="/about">Как это работает?</Link>
            <Link to="/instructions">Инструкция</Link>
            <img
            src="/github-mark-white.svg"
            alt="Github"
            width={30}
            height={30}
            className="hover:cursor-pointer"
            // onClick={() => {router.push("https://github.com/ilya-shlom/breathing-analysis")}}
            priority />
          </nav>
          {/* ── Route Definitions ───────────────────────────────────── */}
        </header>
    )
}