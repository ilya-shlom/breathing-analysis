"use client";
// import { useRouter } from "next/navigation";

export default function Navbar() {

    return (
        <header className="bg-[var(--header-blue)] shadow-md h-15 px-10
         text-white text-xl
         flex flex-row justify-between items-center">
          <h1>breathing-analysis</h1>
          <nav className="flex flex-row gap-10 underline text-lg">
            <a href="/">Главная</a>
            <a href="/about">Как это работает?</a>
            <a href="/instruction">Инструкция</a>
            <img
            src="/github-mark-white.svg"
            alt="Github"
            width={30}
            height={30}
            className="hover:cursor-pointer"
            // onClick={() => {router.push("https://github.com/ilya-shlom/breathing-analysis")}}
            priority />
          </nav>
        </header>
    )
}